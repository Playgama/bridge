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
    ACTION_NAME,
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
} from '../constants'

const SDK_URL = 'https://storage.googleapis.com/social-networth/scripts/sdk.umd.js'

class PortalPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.PORTAL
    }

    get isPaymentsSupported() {
        return true
    }

    get platformLanguage() {
        return this._platformSdk.getLocale() || super.platformLanguage
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PortalSDK').then(() => {
                    this._platformSdk = window.PortalSDK

                    this._platformSdk.initialize()
                        .then(() => {
                            this._platformSdk.initializeOverlay()

                            this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                            this._isInitialized = true
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
                const promises = key.map((k) => Promise.resolve(this._platformSdk.getValue(k)).then((rawValue) => {
                    let parsedValue = rawValue
                    if (tryParseJson && typeof rawValue === 'string') {
                        try {
                            parsedValue = JSON.parse(rawValue)
                        } catch (e) {
                            // keep as-is
                        }
                    }
                    return parsedValue
                }))

                return Promise.all(promises)
            }

            return Promise.resolve(this._platformSdk.getValue(key)).then((rawValue) => {
                let parsedValue = rawValue
                if (tryParseJson && typeof rawValue === 'string') {
                    try {
                        parsedValue = JSON.parse(rawValue)
                    } catch (e) {
                        // keep as-is
                    }
                }
                return parsedValue
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                if (!Array.isArray(value)) {
                    return Promise.reject(new Error('Value must be an array if key is an array'))
                }
                if (key.length !== value.length) {
                    return Promise.reject(new Error('Key and value arrays must have the same length'))
                }
                const promises = key.map((k, i) => Promise.resolve(this._platformSdk.setValue(k, value[i])))
                return Promise.all(promises)
            }
            return Promise.resolve(this._platformSdk.setValue(key, value))
        }
        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const promises = key.map((k) => Promise.resolve(this._platformSdk.removeValue(k)))
                return Promise.all(promises)
            }
            return Promise.resolve(this._platformSdk.removeValue(key))
        }
        return super.deleteDataFromStorage(key, storageType)
    }

    showInterstitial() {
        this._platformSdk.requestAd()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            })
    }

    showRewarded() {
        this._platformSdk.requestRewardAd()
            .then((success) => {
                if (success) {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                } else {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                }
            })
            .catch(() => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            })
    }

    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.gameReady()
                return Promise.resolve()
            }
            default:
                return super.sendMessage(message)
        }
    }

    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const platformProductId = product.id

            Promise.resolve(this._platformSdk.getShopItems())
                .then((catalog) => {
                    const catalogProduct = catalog.find((x) => x && x.id === platformProductId)
                    if (!catalogProduct) {
                        throw new Error('Shop item not found in catalog')
                    }

                    return this._platformSdk.openPurchaseConfirmModal(catalogProduct)
                })
                .then((purchase) => {
                    if (purchase && (purchase.status === 'success')) {
                        const mergedPurchase = {
                            id,
                            ...purchase,
                        }
                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else {
                        throw new Error('Purchase failed')
                    }
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
            return Promise.reject(new Error('No platform products available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            Promise.resolve(this._platformSdk.getShopItems())
                .then((catalog) => {
                    if (!Array.isArray(catalog)) {
                        throw new Error('Catalog response is not an array')
                    }

                    const mergedProducts = products
                        .map((product) => {
                            const platformId = product.id
                            const catalogProduct = catalog.find((p) => p && p.id === platformId)

                            if (!catalogProduct) {
                                return null
                            }

                            return {
                                id: product.id,
                                name: catalogProduct.name,
                                price: `${catalogProduct.price} Gems`,
                                priceCurrencyCode: 'Gems',
                                priceValue: catalogProduct.price,
                            }
                        })
                        .filter(Boolean)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            Promise.resolve(this._platformSdk.getPurchasedShopItems())
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const platformProductId = purchase.id
                        const product = products.find((p) => p.id === platformProductId)
                        if (!product) {
                            return null
                        }

                        const mergedPurchase = {
                            id: product.id,
                            ...purchase,
                        }

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

export default PortalPlatformBridge
