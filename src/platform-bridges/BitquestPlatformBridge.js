/*
 * This file is part of Playgama Bridge.
 *
 * Playgama Bridge is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * Playgama Bridge is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Playgama Bridge. If not, see <https://www.gnu.org/licenses/>.
 */

import PlatformBridgeBase from './PlatformBridgeBase'
import { addJavaScript, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    STORAGE_TYPE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../constants'

class BitquestPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.BITQUEST
    }

    get isPaymentsSupported() {
        return true
    }

    get isPlayerAuthorizationSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const SDK_URL = 'https://app-stage.bitquest.games/bqsdk.min.js'

            addJavaScript(SDK_URL).then(() => {
                waitFor('bq').then(() => {
                    this._platformSdk = window.bq

                    this._platformSdk.initialize()
                        .then(() => {
                            this._platformSdk.platform.sendMessage('game_ready')

                            const { player } = this._platformSdk
                            const { id = null, name = '' } = player
                            this._playerId = id
                            this._playerName = name
                            this._isPlayerAuthorized = true

                            this._isInitialized = true
                            this.setupAdvertisementHandlers()
                            this.showInterstitial()

                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                        .catch((e) => {
                            this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e)
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const promises = key.map((k) => this._platformSdk.storage.get(k, 'platform_internal').then((rawValue) => {
                    let parsedValue = rawValue

                    if (tryParseJson && typeof rawValue === 'string') {
                        try {
                            parsedValue = JSON.parse(rawValue)
                        } catch (e) {
                            // keep parsedValue as-is
                        }
                    }

                    return parsedValue
                }))

                return Promise.all(promises)
            }

            return this._platformSdk.storage.get(key, 'platform_internal').then((rawValue) => {
                let parsedValue = rawValue

                if (tryParseJson && typeof rawValue === 'string') {
                    try {
                        parsedValue = JSON.parse(rawValue)
                    } catch (e) {
                        // keep parsedValue as-is
                    }
                }

                return parsedValue
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    async setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                if (!Array.isArray(value)) {
                    throw new Error('Value must be an array if key is an array')
                }

                if (key.length !== value.length) {
                    throw new Error('Key and value arrays must have the same length')
                }

                /* eslint-disable no-await-in-loop */
                for (let i = 0; i < key.length; i++) {
                    await this._platformSdk.storage.set(key[i], value[i], 'platform_internal')
                }
                /* eslint-enable no-await-in-loop */
                return
            }

            await this._platformSdk.storage.set(key, value, 'platform_internal')
            return
        }

        await super.setDataToStorage(key, value, storageType)
    }

    async deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                /* eslint-disable no-await-in-loop */
                for (let i = 0; i < key.length; i++) {
                    await this._platformSdk.storage.delete(key[i], 'platform_internal')
                }
                /* eslint-enable no-await-in-loop */

                return
            }

            await this._platformSdk.storage.delete(key, 'platform_internal')
            return
        }

        await super.deleteDataFromStorage(key, storageType)
    }

    showRewarded() {
        this._platformSdk.advertisement.showRewarded()
    }

    showInterstitial() {
        this._platformSdk.advertisement.showInterstitial()
    }

    showBanner() {
        this._platformSdk.advertisement.showBanner()
    }

    hideBanner() {
        this._platformSdk.advertisement.hideBanner()
    }

    paymentsPurchase(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.payment.purchase(id)
                .then((purchase) => {
                    const mergedPurchase = {
                        id,
                        ...purchase.purchaseData,
                    }

                    delete mergedPurchase.productID

                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()

        if (!products || !Array.isArray(products) || products.length === 0) {
            console.warn('[paymentsGetCatalog] No platform products available')
            return Promise.reject(new Error('No platform products available'))
        }

        if (!this._isInitialized || !this._platformSdk?.payment) {
            console.warn('[paymentsGetCatalog] SDK not initialized or missing payment object')
            return Promise.reject(new Error('SDK not initialized or payment not available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.payment.getCatalog()
                .then((catalog) => {
                    console.info('[paymentsGetCatalog] Catalog received:', catalog)

                    if (!Array.isArray(catalog)) {
                        throw new Error('Catalog response is not an array')
                    }

                    const mergedProducts = products
                        .map((product) => {
                            const catalogProduct = catalog.find((p) => p.purchaseId === product.id)

                            if (!catalogProduct) {
                                console.warn(`[paymentsGetCatalog] No match found for product ID: ${product.id}`)
                                return null
                            }

                            return {
                                name: catalogProduct.name,
                                description: catalogProduct.description,
                                id: catalogProduct.purchaseId,
                                price: catalogProduct.priceValue,
                                priceCurrencyCode: catalogProduct.currencyCode,
                                priceValue: catalogProduct.price,
                            }
                        })
                        .filter(Boolean)

                    console.info('[paymentsGetCatalog] Merged products:', mergedProducts)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
                    console.error('[paymentsGetCatalog] Failed to get catalog:', error)
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.payment.consumePurchase(id)
                .then(() => {
                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.payment.getPurchases()
                .then((response) => {
                    const purchases = response?.purchases
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.purchaseId)
                        if (!product) {
                            return null
                        }

                        const mergedPurchase = {
                            id: product.id,
                            ...purchase,
                        }

                        delete mergedPurchase.purchaseId
                        return mergedPurchase
                    }).filter(Boolean)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    getServerTime() {
        return new Promise((resolve) => {
            const ts = this._platformSdk.platform.getServerTime()
            resolve(ts)
        })
    }

    #setupAdvertisementHandlers() {
        const rewardedMap = {
            loading: REWARDED_STATE.LOADING,
            opened: REWARDED_STATE.OPENED,
            closed: REWARDED_STATE.CLOSED,
            failed: REWARDED_STATE.FAILED,
            rewarded: REWARDED_STATE.REWARDED,
        }

        const interstitialMap = {
            loading: INTERSTITIAL_STATE.LOADING,
            opened: INTERSTITIAL_STATE.OPENED,
            closed: INTERSTITIAL_STATE.CLOSED,
            failed: INTERSTITIAL_STATE.FAILED,
        }

        const bannerMap = {
            loading: BANNER_STATE.LOADING,
            shown: BANNER_STATE.SHOWN,
            hidden: BANNER_STATE.HIDDEN,
            failed: BANNER_STATE.FAILED,
        }

        this._platformSdk.advertisement.on('REWARDED_STATE_CHANGED', (state) => {
            const mappedState = rewardedMap[state]
            if (!mappedState) return

            this._setRewardedState(mappedState)

            if (mappedState === REWARDED_STATE.REWARDED) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            }
        })

        this._platformSdk.advertisement.on('INTERSTITIAL_STATE_CHANGED', (state) => {
            const mappedState = interstitialMap[state]
            if (mappedState) {
                this._setInterstitialState(mappedState)
            }
        })

        this._platformSdk.advertisement.on('BANNER_STATE_CHANGED', (state) => {
            const mappedState = bannerMap[state]
            if (mappedState) {
                this._setBannerState(mappedState)
            }
        })
    }

}

export default BitquestPlatformBridge
