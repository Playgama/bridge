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
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://playgama.com/platform-sdk/v1.js'

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
        return this.#isPaymentsSupported
    }

    get platformLanguage() {
        return this._platformSdk.platformService.getLanguage() || super.platformLanguage
    }

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady() {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    _isAdvancedBannersSupported = true

    #isPaymentsSupported = true

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

                    this._platformSdk.advService.subscribeToAdStateChanges((adType, state) => {
                        if (adType === 'interstitial') {
                            switch (state) {
                                case 'open': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                    break
                                }
                                case 'empty': {
                                    this._showAdFailurePopup(false)
                                    break
                                }
                                case 'close': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                    break
                                }
                                case 'error': {
                                    this._showAdFailurePopup(false)
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
                                    this._showAdFailurePopup(true)
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
                                    this._showAdFailurePopup(true)
                                    break
                                }
                                default: {
                                    break
                                }
                            }
                        }
                    })

                    Promise.all([
                        this.#getPlayer(),
                        this._platformSdk.platformService?.isReady,
                    ]).then(() => {
                        if (this._platformSdk.platformService?.getIsPaymentsSupported) {
                            this.#isPaymentsSupported = this._platformSdk.platformService.getIsPaymentsSupported()
                        }
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })

                    if (this._platformSdk.platformService.getAdditionalParams) {
                        this._additionalData = this._platformSdk.platformService.getAdditionalParams() || {}
                    }
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
    loadCloudSnapshot() {
        return this._platformSdk.cloudSaveApi.getState()
    }

    saveCloudSnapshot(snapshot) {
        return this._platformSdk.cloudSaveApi.setItems(snapshot)
    }

    deleteCloudKeys(snapshot) {
        return this._platformSdk.cloudSaveApi.setItems(snapshot)
    }

    // advertisement
    showInterstitial() {
        this._platformSdk.advService.showInterstitial()
    }

    showRewarded() {
        this._platformSdk.advService.showRewarded()
    }

    showAdvancedBanners(banners) {
        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        this._platformSdk.advService.showAdvancedBanners(banners)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
            })
    }

    hideAdvancedBanners() {
        this._platformSdk.advService.hideAdvancedBanners()
        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }

    checkAdBlock() {
        return this._platformSdk.advService.checkAdBlock()
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
                        if (this._platformSdk.inGamePaymentsApi.confirmDelivery) {
                            this._platformSdk.inGamePaymentsApi.confirmDelivery({
                                orderId: purchase.orderId,
                                externalId: mergedPurchase.externalId,
                            }).catch(() => { /* purchase is resolved regardless */ })
                        }
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

    paymentsGetPurchases() {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        if (this._platformSdk.inGamePaymentsApi.getPurchases) {
            const promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.inGamePaymentsApi.getPurchases()
                .then((purchases) => {
                    this._paymentsPurchases = purchases
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, purchases)
                })
                .catch(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })

            return promiseDecorator.promise
        }

        return Promise.resolve(this._paymentsPurchases)
    }

    paymentsConsumePurchase(id) {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        const purchase = this._paymentsPurchases.find((p) => p.id === id)
        if (!purchase) {
            return Promise.reject()
        }

        if (this._platformSdk.inGamePaymentsApi.consumePurchase) {
            const promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.inGamePaymentsApi.consumePurchase(purchase.orderId, purchase.externalId)
                .then(() => {
                    const idx = this._paymentsPurchases.findIndex((p) => p.id === id)
                    if (idx >= 0) {
                        this._paymentsPurchases.splice(idx, 1)
                    }
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })

            return promiseDecorator.promise
        }

        return super.paymentsConsumePurchase(id)
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
                    if (player.isAuthorized) {
                        this._isPlayerAuthorized = true
                        this._playerId = player.id
                        this._playerName = player.name
                        this._playerPhotos = player.photos
                        this._playerExtra = player
                        this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                    } else {
                        this._playerApplyGuestData()
                    }
                })
                .catch(() => {
                    this._playerApplyGuestData()
                })
                .finally(() => {
                    resolve()
                })
        })
    }
}

export default PlaygamaPlatformBridge
