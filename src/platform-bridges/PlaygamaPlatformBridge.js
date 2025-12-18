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
    PLATFORM_MESSAGE,
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
        return this._platformSdk.platformService.getLanguage() || super.platformLanguage
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

                    console.info('[PlaygamaBridge][Player] Initialization started (Playgama SDK ready)', { t_s: (performance.now() / 1000).toFixed(3) })

                    this._platformSdk.advService.subscribeToAdStateChanges((adType, state) => {
                        if (adType === 'interstitial') {
                            switch (state) {
                                case 'open': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                    break
                                }
                                case 'empty': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                                    break
                                }
                                case 'close': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                    break
                                }
                                case 'error': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                                    break
                                }
                                default: {
                                    break
                                }
                            }
                        } else if (adType === 'rewarded') {
                            switch (state) {
                                case 'open': {
                                    this._setRewardedState(REWARDED_STATE.OPENED)
                                    break
                                }
                                case 'empty': {
                                    this._setRewardedState(REWARDED_STATE.FAILED)
                                    break
                                }
                                case 'rewarded': {
                                    this._setRewardedState(REWARDED_STATE.REWARDED)
                                    break
                                }
                                case 'close': {
                                    this._setRewardedState(REWARDED_STATE.CLOSED)
                                    break
                                }
                                case 'error': {
                                    this._setRewardedState(REWARDED_STATE.FAILED)
                                    break
                                }
                                default: {
                                    break
                                }
                            }
                        }
                    })

                    // Proactively try to authorize at startup; ignore rejection/denial
                    const preAuthPromise = (this._platformSdk?.userService?.authorizeUser
                        ? this._platformSdk.userService.authorizeUser().catch((error) => {
                            console.info('[PlaygamaBridge][Player] Startup authorizeUser() failed or skipped', { error })
                        })
                        : Promise.resolve())

                    preAuthPromise.finally(() => {
                        this.#getPlayer().then(() => {
                            console.info('[PlaygamaBridge][Player] Initialization finished', {
                                authorized: this._isPlayerAuthorized,
                                id: this._playerId,
                                name: this._playerName,
                                t_s: (performance.now() / 1000).toFixed(3),
                            })
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.gameService.gameReady()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
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
        this._platformSdk.advService.showInterstitial()
    }

    showRewarded() {
        this._platformSdk.advService.showRewarded()
    }

    authorizePlayer(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            console.info('[PlaygamaBridge][Player] authorizePlayer() called', {
                alreadyAuthorized: this._isPlayerAuthorized,
                t_s: (performance.now() / 1000).toFixed(3),
            })

            if (this._isPlayerAuthorized) {
                this.#getPlayer(options)
                    .then(() => {
                        console.info('[PlaygamaBridge][Player] authorizePlayer() refresh complete', {
                            authorized: this._isPlayerAuthorized,
                            id: this._playerId,
                            name: this._playerName,
                            t_s: (performance.now() / 1000).toFixed(3),
                        })
                        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    })
            } else {
                console.info('[PlaygamaBridge][Player] Calling userService.authorizeUser()')
                this._platformSdk.userService.authorizeUser()
                    .then(() => {
                        console.info('[PlaygamaBridge][Player] authorizeUser() resolved')
                        this.#getPlayer(options)
                            .then(() => {
                                console.info('[PlaygamaBridge][Player] Player data loaded after authorizeUser()', {
                                    authorized: this._isPlayerAuthorized,
                                    id: this._playerId,
                                    name: this._playerName,
                                    t_s: (performance.now() / 1000).toFixed(3),
                                })
                                this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                            })
                    })
                    .catch((error) => {
                        console.info('[PlaygamaBridge][Player] authorizeUser() failed', { error })
                        this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                    })
            }
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id, options) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        if (options && options.externalId) {
            product.externalId = options.externalId
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
            console.info('[PlaygamaBridge][Player] getUser() called', { t_s: (performance.now() / 1000).toFixed(3) })
            this._platformSdk.userService.getUser()
                .then((player) => {
                    if (player.isAuthorized) {
                        console.info('[PlaygamaBridge][Player] getUser() returned authorized user')
                        this._isPlayerAuthorized = true
                        this._playerId = player.id
                        this._playerName = player.name
                        this._playerPhotos = player.photos
                        this._playerExtra = player
                        this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                        console.info('[PlaygamaBridge][Player] Info', {
                            id: this._playerId,
                            name: this._playerName,
                            photos: this._playerPhotos,
                            extra: this._playerExtra,
                            t_s: (performance.now() / 1000).toFixed(3),
                        })
                        return this.#getDataFromPlatformStorage([])
                    }

                    console.info('[PlaygamaBridge][Player] getUser() returned guest user')
                    this._playerApplyGuestData()
                    return Promise.resolve()
                })
                .catch((error) => {
                    console.info('[PlaygamaBridge][Player] getUser() failed', { error })
                    this._playerApplyGuestData()
                })
                .finally(() => {
                    console.info('[PlaygamaBridge][Player] getUser() finished', {
                        authorized: this._isPlayerAuthorized,
                        id: this._playerId,
                        name: this._playerName,
                        t_s: (performance.now() / 1000).toFixed(3),
                    })
                    resolve()
                })
        })
    }

    async #getDataFromPlatformStorage(key, tryParseJson = true) {
        if (!this._platformStorageCachedData) {
            this._platformStorageCachedData = await this.platformSdk.cloudSaveApi.getState()
        }

        return getKeysFromObject(key, this._platformStorageCachedData, tryParseJson)
    }
}

export default PlaygamaPlatformBridge
