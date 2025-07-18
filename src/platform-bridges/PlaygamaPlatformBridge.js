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
import { addJavaScript, waitFor, getKeysFromObject } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    ERROR,
} from '../constants'

const SDK_URL = 'https://developer.playgama.com/sdk/v1.js'

class PlaygamaPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.PLAYGAMA
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    get platformLanguage() {
        return this._platformSdk.platformService.getLanguage()
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PLAYGAMA_SDK').then(() => {
                    this._platformSdk = window.PLAYGAMA_SDK
                    this.#getPlayer().then(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return this.#getDataFromPlatformStorage(key, tryParseJson)
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                if (!this._isPlayerAuthorized) {
                    return Promise.reject()
                }

                return new Promise((resolve, reject) => {
                    const data = this._platformStorageCachedData !== null
                        ? { ...this._platformStorageCachedData }
                        : {}

                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            data[key[i]] = value[i]
                        }
                    } else {
                        data[key] = value
                    }

                    this.platformSdk.cloudSaveApi.setItems(data)
                        .then(() => {
                            this._platformStorageCachedData = data
                            resolve()
                        })
                        .catch((error) => {
                            reject(error)
                        })
                })
            }
            case STORAGE_TYPE.LOCAL_STORAGE: {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = (typeof value[i] !== 'string') ? JSON.stringify(value[i]) : value[i]
                    }
                } else {
                    data[key] = (typeof value !== 'string') ? JSON.stringify(value) : value
                }

                this._platformSdk.storageApi.setItems(data)
                return super.setDataToStorage(key, value, storageType)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    deleteDataFromStorage(key, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                return new Promise((resolve, reject) => {
                    const data = this._platformStorageCachedData !== null
                        ? { ...this._platformStorageCachedData }
                        : {}

                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            delete data[key[i]]
                        }
                    } else {
                        delete data[key]
                    }

                    this.platformSdk.cloudSaveApi.setItems(data)
                        .then(() => {
                            this._platformStorageCachedData = data
                            resolve()
                        })
                        .catch((error) => {
                            reject(error)
                        })
                })
            }
            case STORAGE_TYPE.LOCAL_STORAGE: {
                this._platformSdk.storageApi.deleteItems(Array.isArray(key) ? key : [key])
                return super.deleteDataFromStorage(key, storageType)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    // advertisement
    showInterstitial() {
        this._platformSdk.advService.showInterstitial({
            onOpen: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            onEmpty: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            },
            onClose: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            },
            onError: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            },
        })
    }

    showRewarded() {
        this._platformSdk.advService.showRewarded({
            onOpen: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            onRewarded: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            onEmpty: () => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            },
            onClose: () => {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            },
            onError: () => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            },
        })
    }

    authorizePlayer(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this.#getPlayer(options)
                    .then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    })
            } else {
                this._platformSdk.userService.authorizeUser()
                    .then(() => {
                        this.#getPlayer(options)
                            .then(() => {
                                this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                            })
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                    })
            }
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        if (!product.externalId) {
            product.externalId = this._paymentsGenerateTransactionId(id)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.inGamePaymentsApi.purchase(product)
                .then((purchase) => {
                    if (purchase.status === 'PAID') {
                        const mergedPurchase = { id, ...purchase }
                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else {
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, purchase.error)
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
        if (!products) {
            return Promise.reject()
        }

        const updatedProducts = products.map((product) => ({
            id: product.id,
            price: `${product.amount} Gam`,
            priceCurrencyCode: 'Gam',
            priceCurrencyImage: 'https://games.playgama.com/assets/gold-fennec-coin-large.webp',
            priceValue: product.amount,
        }))

        return Promise.resolve(updatedProducts)
    }

    #getPlayer() {
        return new Promise((resolve) => {
            this._platformSdk.userService.getUser()
                .then((player) => {
                    this._playerId = player.id
                    this._isPlayerAuthorized = player.isAuthorized
                    this._playerName = player.name
                    this._playerPhotos = player.photos
                    this._defaultStorageType = this._isPlayerAuthorized
                        ? STORAGE_TYPE.PLATFORM_INTERNAL
                        : STORAGE_TYPE.LOCAL_STORAGE
                    if (this._isPlayerAuthorized) {
                        return this.#getDataFromPlatformStorage([])
                    }

                    return Promise.resolve()
                })
                .finally(() => {
                    resolve()
                })
        })
    }

    async #getDataFromPlatformStorage(key, tryParseJson = false) {
        if (!this._platformStorageCachedData) {
            this._platformStorageCachedData = await this.platformSdk.cloudSaveApi.getState()
        }

        return getKeysFromObject(key, this._platformStorageCachedData, tryParseJson)
    }
}

export default PlaygamaPlatformBridge
