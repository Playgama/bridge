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

    _isBannerSupported = false

    initialize() {
        console.info('BitQuest SDK initialize')
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            console.info('Before BitQuest SDK URL')
            const SDK_URL = 'https://app-stage.bitquest.games/bqsdk.min.js'
            console.info('BitQuest SDK URL')
            console.info('Adding javascript')

            addJavaScript(SDK_URL).then(() => {
                console.info('BitQuest SDK added')
                waitFor('bq').then(async () => {
                    console.info('BitQuest SDK available, initializing...')

                    this._platformSdk = window.bq
                    // Await bq.initialize()
                    try {
                        await this._platformSdk.initialize()
                        console.info('BitQuest SDK fully initialized')
                    } catch (e) {
                        console.error('Error during bq.initialize():', e)
                        this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e)
                        return
                    }

                    this._platformSdk.platform.sendMessage('game_ready')

                    const player = this._platformSdk?.player
                    if (player) {
                        const { id = null, name = '' } = player
                        this._playerId = id
                        this._playerName = name
                    } else {
                        console.warn('[Player Init] platformSdk.player is not available')
                    }

                    this._isInitialized = true

                    // this.setupInterstitialHandlers()
                    // this.setupRewardedHandlers()
                    this.setupAdvertisementHandlers()

                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
            })
        }

        return promiseDecorator.promise
    }

    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            // return this._platformSdk.player.isLoggedIn
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            // return this._platformSdk.player.isLoggedIn
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
                console.info('[setDataToStorage] Detected array of keys')

                if (!Array.isArray(value)) {
                    console.warn('[setDataToStorage] Expected array of values for array of keys')
                    throw new Error('Value must be an array if key is an array')
                }

                if (key.length !== value.length) {
                    console.warn('[setDataToStorage] Mismatch between key and value lengths')
                    throw new Error('Key and value arrays must have the same length')
                }

                /* eslint-disable no-await-in-loop */
                for (let i = 0; i < key.length; i++) {
                    console.info(`[setDataToStorage] Setting key: ${key[i]}, value:`, value[i])
                    await this._platformSdk.storage.set(key[i], value[i], 'platform_internal')
                }
                /* eslint-enable no-await-in-loop */
                return
            }

            console.info(`[setDataToStorage] Setting single key: ${key}, value:`, value)
            await this._platformSdk.storage.set(key, value, 'platform_internal')
            return
        }

        // Assuming super.setDataToStorage is also an async method that returns a Promise,
        // but your method is expected to return void, so don't return its result directly.
        await super.setDataToStorage(key, value, storageType)
    }

    async deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                console.info('[deleteDataFromStorage] Detected array of keys')

                /* eslint-disable no-await-in-loop */
                for (let i = 0; i < key.length; i++) {
                    console.info(`[deleteDataFromStorage] Deleting key: ${key[i]}`)
                    await this._platformSdk.storage.delete(key[i], 'platform_internal')
                }
                /* eslint-enable no-await-in-loop */

                return // for consistent-return
            }

            console.info(`[deleteDataFromStorage] Deleting single key: ${key}`)
            await this._platformSdk.storage.delete(key, 'platform_internal')
            return
        }

        await super.deleteDataFromStorage(key, storageType)
    }

    setupAdvertisementHandlers() {
        console.info('BitQuest SDK setupAdvertisementHandlers')

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
            console.info('[Ad State] Rewarded:', state)
            const mappedState = rewardedMap[state]
            if (!mappedState) return

            this._setRewardedState?.(mappedState)

            if (mappedState === REWARDED_STATE.REWARDED) {
                // Automatically follow with 'closed'
                this._setRewardedState?.(REWARDED_STATE.CLOSED)
            }
        })

        this._platformSdk.advertisement.on('INTERSTITIAL_STATE_CHANGED', (state) => {
            console.info('[Ad State] Interstitial:', state)
            const mappedState = interstitialMap[state]
            if (mappedState) {
                this._setInterstitialState?.(mappedState)
            }
        })

        this._platformSdk.advertisement.on('BANNER_STATE_CHANGED', (state) => {
            console.info('[Ad State] Banner:', state)
            const mappedState = bannerMap[state]
            if (mappedState) {
                this._setBannerState?.(mappedState)
            }
        })
    }

    showRewarded() {
        console.info('BitQuest SDK showRewarded')
        this._platformSdk.advertisement.showRewarded()
    }

    showInterstitial() {
        console.info('BitQuest SDK showInterstitial')
        this._platformSdk.advertisement.showInterstitial()
    }

    showBanner() {
        console.info('BitQuest SDK showBanner')
        this._platformSdk.advertisement.showBanner()
    }

    hideBanner() {
        console.info('BitQuest SDK hideBanner')
        this._platformSdk.advertisement.hideBanner()
    }

    paymentsPurchase(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const bq = this._platformSdk

            bq.payment.purchase(id)
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
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.payment.getCatalog()
                .then((catalog) => {
                    console.info('[Full Catalog]', catalog)

                    const platformId = this._platformSdk?.getPlatformId?.() || 'playgama'
                    console.info('[Platform ID]', platformId)
                    console.info('[Local Products]', products)

                    const mergedProducts = products
                        .map((product) => {
                            const catalogProduct = catalog.find((p) => p.purchaseId === product.id)

                            if (!catalogProduct) {
                                console.warn('[Catalog Match Not Found] for product id:', product.id)
                                return null // skip this product
                            }

                            console.info('[Catalog Match Found]', catalogProduct)

                            const finalProduct = {
                                name: catalogProduct.name,
                                description: catalogProduct.description,
                                purchaseId: product.id,
                                price: catalogProduct.price,
                                priceCurrencyCode: catalogProduct.currencyCode ?? 'ϐ',
                                priceValue: catalogProduct.priceValue ?? `${catalogProduct.price} ϐ`,
                            }

                            console.info('[Final Merged Product]', finalProduct)
                            return finalProduct
                        })
                        .filter(Boolean) // Remove nulls (unmatched products)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
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

            const bq = this._platformSdk

            bq.payment.getPurchases()
                .then((response) => {
                    const purchases = response?.purchases
                    if (!Array.isArray(purchases)) {
                        console.error('[GetPurchases] Expected response.purchases to be an array, but got:', purchases)
                        this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, new Error('Invalid purchases format'))
                        return
                    }

                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.purchaseId)
                        if (!product) {
                            console.warn('[Purchase Match Not Found] for purchaseId:', purchase.purchaseId)
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
}

export default BitquestPlatformBridge
