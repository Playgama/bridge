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
import {
    ACTION_NAME,
    INTERSTITIAL_STATE,
    PLATFORM_ID,
    REWARDED_STATE,
} from '../constants'
import {
    addJavaScript,
    deformatPrice,
    postToWebView,
    waitFor,
} from '../common/utils'

const PLAYGAMA_ADS_SDK_URL = 'https://playgama.com/ads/msn.v0.1.js'
const PLAYGAMA_ADS_ID = 'msn-store'

class MicrosoftStorePlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.MICROSOFT_STORE
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    #playgamaAds = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            try {
                this.#setupHandlers()
                this.#postMessage(ACTION_NAME.INITIALIZE)
            } catch (error) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    error,
                )
            }

            addJavaScript(PLAYGAMA_ADS_SDK_URL)
                .then(() => waitFor('pgAds'))
                .then(() => {
                    window.pgAds.init(PLAYGAMA_ADS_ID)
                        .then(() => {
                            this.#playgamaAds = window.pgAds
                            const { gameId } = this._options
                            this.#playgamaAds.updateTargeting({ gameId })
                        })
                })
        }

        return promiseDecorator.promise
    }

    showInterstitial() {
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

    showRewarded() {
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

    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)
            this.#postMessage(ACTION_NAME.PURCHASE, id)
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
            this.#postMessage(ACTION_NAME.CONSUME_PURCHASE, this._paymentsPurchases[purchaseIndex].purchaseToken)
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
            this.#postMessage(ACTION_NAME.GET_CATALOG, products.map(({ platformProductId }) => platformProductId))
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)
            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    #postMessage(action, data) {
        postToWebView(JSON.stringify({ action, data }))
    }

    #setupHandlers() {
        window.chrome.webview.addEventListener('message', (event) => {
            try {
                let data

                if (typeof event.data === 'string') {
                    data = JSON.parse(event.data)
                }

                const { action } = data || {}

                if (action === ACTION_NAME.INITIALIZE) {
                    this.#initialize(data)
                } else if (action === ACTION_NAME.GET_CATALOG) {
                    this.#getCatalog(data)
                } else if (action === ACTION_NAME.PURCHASE) {
                    this.#purchase(data)
                } else if (action === ACTION_NAME.CONSUME_PURCHASE) {
                    this.#consumePurchase(data)
                } else if (action === ACTION_NAME.GET_PURCHASES) {
                    this.#getPurchases(data)
                }
            } catch (error) {
                console.error('Error parsing Microsoft Store message:', error)
            }
        })
    }

    #initialize(data) {
        if (data && data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.INITIALIZE,
                new Error(data),
            )
            return
        }

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
    }

    #getCatalog(data) {
        if (!data || data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_CATALOG,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()
        const mergedProducts = products.map((product) => {
            const msProduct = data.data?.find((p) => p.id === product.platformProductId)

            const priceValue = deformatPrice(msProduct?.price.formattedPrice)
            const priceCurrencyCode = msProduct?.price.currencyCode || null
            const price = `${priceValue} ${priceCurrencyCode}`

            return {
                id: product.id,
                title: msProduct?.title,
                description: msProduct?.description,
                price,
                priceValue,
                priceCurrencyCode,
            }
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
    }

    #purchase(data) {
        if (!data || data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.PURCHASE,
                new Error(data),
            )
            return
        }

        const mergedPurchase = {
            id: data.id,
            ...data.data,
        }

        this._paymentsPurchases.push(mergedPurchase)
        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
    }

    #consumePurchase(data) {
        if (!data || data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.CONSUME_PURCHASE,
                new Error(data),
            )
            return
        }

        const purchaseIndex = this._paymentsPurchases.findIndex(
            (p) => p.purchaseToken === data.purchaseToken || p.id === data.id,
        )

        if (purchaseIndex >= 0) {
            this._paymentsPurchases.splice(purchaseIndex, 1)
        }

        this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, data)
    }

    #getPurchases(data) {
        if (!data || data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_PURCHASES,
                new Error(data),
            )
            return
        }

        this._paymentsPurchases = (data.data || []).map((purchase) => {
            const mergedPurchase = { ...purchase }

            if (!mergedPurchase.id) {
                mergedPurchase.id = purchase.productId || purchase.platformProductId || purchase.purchaseToken
            }

            return mergedPurchase
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
    }
}

export default MicrosoftStorePlatformBridge
