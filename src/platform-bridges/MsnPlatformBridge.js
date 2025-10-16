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
    BANNER_POSITION,
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = 'https://assets.msn.com/staticsb/statics/latest/msstart-games-sdk/msstart-v1.0.0-rc.20.min.js'
const PLAYGAMA_ADS_SDK_URL = 'https://playgama.com/ads/msn.v0.1.js'

class MsnPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.MSN
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // social
    get isShareSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return this.#isPaymentsSupported
    }

    #playgamaAds = null

    #isPaymentsSupported = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('$msstart'))
                .then(() => {
                    this._platformSdk = window.$msstart
                    this._platformSdk.getSignedInUserAsync()
                        .then((data) => {
                            this.#updatePlayerInfo(data)
                        })
                        .catch(() => {
                            this.#updatePlayerInfo(null)
                        })
                        .finally(() => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                })

            const advertisementBackfillId = this._options?.advertisement?.backfillId
            if (advertisementBackfillId) {
                addJavaScript(PLAYGAMA_ADS_SDK_URL)
                    .then(() => waitFor('pgAds'))
                    .then(() => {
                        window.pgAds.init(advertisementBackfillId)
                            .then(() => {
                                this.#playgamaAds = window.pgAds
                                const { gameId } = this._options
                                this.#playgamaAds.updateTargeting({ gameId })
                            })
                    })
            }
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
                    this.#updatePlayerInfo(null)
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

    // leaderboards
    leaderboardsSetScore(id, score) {
        return new Promise((resolve, reject) => {
            this._platformSdk.submitGameResultsAsync(score)
                .then(resolve)
                .catch(reject)
        })
    }

    // advertisement
    showBanner(position) {
        let size

        switch (position) {
            case BANNER_POSITION.TOP:
                size = 'top:728x90'
                break
            case BANNER_POSITION.BOTTOM:
            default:
                size = 'bottom:320x50'
                break
        }

        this._platformSdk.showDisplayAdsAsync([size])
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        this._platformSdk.hideDisplayAdsAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
    }

    showInterstitial() {
        this._platformSdk.loadAdsAsync(false)
            .then((adInstance) => this._platformSdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return adInstance.showAdsCompletedAsync
            })
            .then(() => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED))
            .catch(() => this.#showPlaygamaInterstitial())
    }

    showRewarded() {
        this._platformSdk.loadAdsAsync(true)
            .then((adInstance) => this._platformSdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return adInstance.showAdsCompletedAsync
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => this.#showPlaygamaRewarded())
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

            this._platformSdk.iap.purchaseAsync({ productId: product.platformProductId })
                .then((purchase) => {
                    if (purchase.code === 'IAP_PURCHASE_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, purchase.description)
                        return
                    }

                    const mergedPurchase = {
                        id,
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
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.iap.consumeAsync({ productId: this._paymentsPurchases[purchaseIndex].id })
                .then((response) => {
                    if (response.code === 'IAP_CONSUME_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, response.description)
                        return
                    }

                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    const result = {
                        id,
                        ...response.consumptionReceipt,
                        consumptionSignature: response.consumptionSignature,
                    }

                    delete result.productId
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, result)
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

            this._platformSdk.iap.getAllAddOnsAsync({ productId: this._options.gameId })
                .then((msnProducts) => {
                    if (msnProducts.code === 'IAP_GET_ALL_ADD_ONS_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, msnProducts.description)
                        return
                    }

                    const mergedProducts = products.map((product) => {
                        const msnProduct = msnProducts.find((p) => p.productId === product.platformProductId)

                        return {
                            id: product.id,
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

            this._platformSdk.iap.getAllPurchasesAsync({ productId: this._options.gameId })
                .then((response) => {
                    if (response.code === 'IAP_GET_ALL_PURCHASES_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, response.description)
                        return
                    }

                    const products = this._paymentsGetProductsPlatformData()
                    this._paymentsPurchases = response.receipts.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productId)
                        const mergedPurchase = {
                            id: product.id,
                            ...purchase,
                            receiptSignature: response.receiptSignature,
                        }

                        return mergedPurchase
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    #showPlaygamaInterstitial() {
        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(false)
        }

        return new Promise((resolve) => {
            this.#playgamaAds.requestOutOfPageAd('interstitial')
                .then((adInstance) => {
                    switch (adInstance.state) {
                        case 'empty':
                            this._advertisementShowErrorPopup(false).then(() => resolve())
                            return
                        case 'ready':
                            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                            adInstance.show()
                            break
                        default:
                            break
                    }

                    adInstance.addEventListener('ready', () => {
                        this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                        adInstance.show()
                    })

                    adInstance.addEventListener('empty', () => {
                        this._advertisementShowErrorPopup(false).then(() => resolve())
                    })

                    adInstance.addEventListener('closed', () => {
                        this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                        resolve()
                    })
                })
        })
    }

    #showPlaygamaRewarded() {
        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(true)
        }

        return new Promise((resolve) => {
            this.#playgamaAds.requestOutOfPageAd('rewarded')
                .then((adInstance) => {
                    switch (adInstance.state) {
                        case 'empty':
                            this._advertisementShowErrorPopup(true).then(() => resolve())
                            return
                        case 'ready':
                            this._setRewardedState(REWARDED_STATE.OPENED)
                            adInstance.show()
                            break
                        default:
                            break
                    }

                    adInstance.addEventListener('ready', () => {
                        this._setRewardedState(REWARDED_STATE.OPENED)
                        adInstance.show()
                    })

                    adInstance.addEventListener('rewarded', () => {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    })

                    adInstance.addEventListener('empty', () => {
                        this._advertisementShowErrorPopup(true).then(() => resolve())
                    })

                    adInstance.addEventListener('closed', () => {
                        this._setRewardedState(REWARDED_STATE.CLOSED)
                        resolve()
                    })
                })
        })
    }

    #updatePlayerInfo(data) {
        if (data) {
            this._isPlayerAuthorized = true
            this._playerId = data.playerId
            this._playerName = data.playerDisplayName
            this._playerExtra = data
            this.#isPaymentsSupported = data.userAccountType.toLowerCase() === 'personal'
        } else {
            this._playerApplyGuestData()
        }
    }
}

export default MsnPlatformBridge
