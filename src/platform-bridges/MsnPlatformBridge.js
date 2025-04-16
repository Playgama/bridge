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
} from '../constants'

const SDK_URL = 'https://assets.msn.com/staticsb/statics/latest/msstart-games-sdk/msstart-v1.0.0-rc.20.min.js'

class MsnPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.MSN
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // social
    get isShareSupported() {
        return true
    }

    // leaderboard
    get isLeaderboardSupported() {
        return true
    }

    get isLeaderboardSetScoreSupported() {
        return true
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    _preloadedInterstitialPromise = null

    _preloadedRewardedPromise = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('$msstart').then(() => {
                    this._platformSdk = window.$msstart

                    this._platformSdk.getSignedInUserAsync()
                        .then((data) => {
                            this.#updatePlayerInfo(data)
                            this.#loadInterstitialAdsAsync(true)
                            this.#loadRewardAdsAsync(true)
                        })
                        .finally(() => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.signInAsync()
                .then((response) => {
                    this.#updatePlayerInfo(response)
                    resolve()
                })
                .catch((e) => {
                    reject(e)
                })
        })
    }

    // social
    share(options) {
        return new Promise((resolve, reject) => {
            this._platformSdk.shareAsync(options)
                .then(resolve)
                .catch(reject)
        })
    }

    // leaderboard
    setLeaderboardScore(options) {
        if (!options?.score) {
            return Promise.reject(new Error('`score` option is required'))
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.submitGameResultsAsync(options.score)
                .then(resolve)
                .catch(reject)
        })
    }

    // advertisement
    showBanner(options = {}) {
        const position = options.position || 'top:728x90'

        this._platformSdk.showDisplayAdsAsync(
            !Array.isArray(position)
                ? [position]
                : position,
        )
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        if (this._bannerState !== BANNER_STATE.SHOWN) {
            return
        }

        this._platformSdk.hideDisplayAdsAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
    }

    showInterstitial() {
        this.#loadInterstitialAdsAsync()
            .then((adInstance) => this._platformSdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)

                return adInstance.showAdsCompletedAsync
            })
            .then(() => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED))
            .catch(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            })
            .finally(() => {
                this.#loadInterstitialAdsAsync(true)
            })
    }

    showRewarded() {
        this.#loadRewardAdsAsync()
            .then((adInstance) => this._platformSdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setRewardedState(REWARDED_STATE.OPENED)

                return adInstance.showAdsCompletedAsync
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            })
            .finally(() => {
                this.#loadRewardAdsAsync(true)
            })
    }

    // payments
    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.iap.purchaseAsync(product)
                .then((purchase) => {
                    if (purchase.code === 'IAP_PURCHASE_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, purchase.description)
                        return
                    }

                    const mergedPurchase = {
                        commonId: id,
                        ...purchase.receipt,
                        receiptSignature: purchase.receiptSignature,
                    }
                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.commonId === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.iap.consumeAsync(this._paymentsPurchases[purchaseIndex].productId)
                .then((response) => {
                    if (response.code === 'IAP_CONSUME_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, response.description)
                        return
                    }

                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, {
                        ...response.consumptionReceipt,
                        consumptionSignature: response.consumptionSignature,
                    })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
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

            this._platformSdk.iap.getAllAddOnsAsync()
                .then((msnProducts) => {
                    if (msnProducts.code === 'IAP_GET_ALL_ADD_ONS_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, msnProducts.description)
                        return
                    }

                    const mergedProducts = products.map((product) => {
                        const msnProduct = msnProducts.find((p) => p.productId === product.productId)

                        return {
                            commonId: product.commonId,
                            productId: msnProduct.productId,
                            title: msnProduct.title,
                            description: msnProduct.description,
                            publisherName: msnProduct.publisherName,
                            inAppOfferToken: msnProduct.inAppOfferToken,
                            isConsumable: msnProduct.isConsumable,
                            price: `${msnProduct.price.listPrice} ${msnProduct.price.currencyCode} `,
                            priceCurrencyCode: msnProduct.price.currencyCode,
                            priceValue: msnProduct.price.listPrice,
                        }
                    })

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

            this._platformSdk.iap.getPurchasesAsync()
                .then((purchases) => {
                    if (purchases.code === 'IAP_GET_PURCHASES_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, purchases.description)
                        return
                    }

                    const products = this._paymentsGetProductsPlatformData()
                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)
                        return {
                            commonId: product.commonId,
                            ...purchase.receipt,
                            receiptSignature: purchase.receiptSignature,
                        }
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    #loadRewardAdsAsync(forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedRewardedPromise) {
            return this._preloadedRewardedPromise
        }

        this._preloadedRewardedPromise = this.#loadAdsAsync(true)
            .catch(() => {
                this._preloadedRewardedPromise = null
            })
        return this._preloadedRewardedPromise
    }

    #loadInterstitialAdsAsync(forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedInterstitialPromise) {
            return this._preloadedInterstitialPromise
        }

        this._preloadedInterstitialPromise = this.#loadAdsAsync()
            .catch(() => {
                this._preloadedInterstitialPromise = null
            })
        return this._preloadedInterstitialPromise
    }

    #loadAdsAsync(isRewardedAd = false) {
        return new Promise((resolve, reject) => {
            let attempts = 3

            const loadAdsAsync = () => {
                attempts -= 1
                this._platformSdk.loadAdsAsync(isRewardedAd)
                    .then(resolve)
                    .catch((e) => {
                        if (e.code !== 'LOAD_ADS_FAILURE' || attempts < 1) {
                            reject(e)
                        } else {
                            loadAdsAsync()
                        }
                    })
            }

            loadAdsAsync()
        })
    }

    #updatePlayerInfo(data) {
        if (data.playerId) {
            this._playerId = data.playerId
            this._playerName = data.playerDisplayName

            this._isPlayerAuthorized = true
        }
    }
}

export default MsnPlatformBridge
