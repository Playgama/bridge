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
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'

class HuaweiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.HUAWEI
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // advertisement
    get isAdvertisementSupported() {
        return true
    }

    async initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.appId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.HUAWEI_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this._appId = this._options.appId

                this.#setupHandlers()

                this.#postMessage(ACTION_NAME.INITIALIZE, this._appId)
            }
        }

        return promiseDecorator.promise
    }

    authorizePlayer() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this.#postMessage(ACTION_NAME.AUTHORIZE_PLAYER)
        }

        return promiseDecorator.promise
    }

    // advertisement
    showInterstitial(placementId) {
        this.#postMessage(ACTION_NAME.SHOW_INTERSTITIAL, placementId)
    }

    showRewarded(placementId) {
        this.#postMessage(ACTION_NAME.SHOW_REWARDED, placementId)
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

            this.#postMessage(ACTION_NAME.PURCHASE, id)
            this._platformSdk.iap.purchaseAsync({ productId: id })
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
                    delete mergedPurchase.productId

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

        // eslint-disable-next-line no-console
        console.log({ products })

        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#postMessage(ACTION_NAME.GET_CATALOG, products.map(({ id }) => id))
        }

        return promiseDecorator.promise
    }

    #postMessage(action, data) {
        window.system.postMessage(JSON.stringify({ action, data }))
    }

    #setupHandlers() {
        window.system.onmessage = (event) => {
            try {
                // eslint-disable-next-line no-console
                console.log('HuaweiPlatformBridge received message:', event)

                const { action, data } = JSON.parse(event)

                if (action === ACTION_NAME.INITIALIZE) {
                    if (data.success) {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
                    } else {
                        this._rejectPromiseDecorator(
                            ACTION_NAME.INITIALIZE,
                            new Error(data),
                        )
                    }
                }

                if (action === ACTION_NAME.SET_INTERSTITIAL_STATE) {
                    if (Object.values(INTERSTITIAL_STATE).includes(data.state)) {
                        this._setInterstitialState(
                            data.state,
                            data.state === INTERSTITIAL_STATE.FAILED ? new Error(data) : undefined,
                        )
                    }
                }

                if (action === ACTION_NAME.SET_REWARDED_STATE) {
                    if (Object.values(REWARDED_STATE).includes(data.state)) {
                        this._setRewardedState(
                            data.state,
                            data.state === INTERSTITIAL_STATE.FAILED ? new Error(data) : undefined,
                        )
                    }
                }

                if (action === ACTION_NAME.GET_CATALOG) {
                    if (data.success) {
                        const products = this._paymentsGetProductsPlatformData()

                        // eslint-disable-next-line no-console
                        const mergedProducts = products.map((product) => {
                            const huaweiProduct = data.data.productInfoList.find((p) => p.productId === product.id)

                            return {
                                id: product.id,
                                title: huaweiProduct.productName,
                                description: huaweiProduct.productDesc,
                                price: huaweiProduct.price,
                                priceCurrencyCode: huaweiProduct.currency,
                                priceValue: huaweiProduct.microsPrice * 0.000001,
                                subSpecialPeriodCycles: huaweiProduct.subSpecialPeriodCycles,
                                subProductLevel: huaweiProduct.subProductLevel,
                                priceType: huaweiProduct.priceType,
                            }
                        })

                        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                    } else {
                        this._rejectPromiseDecorator(
                            ACTION_NAME.GET_CATALOG,
                            new Error(data),
                        )
                    }
                }

                if (action === ACTION_NAME.PURCHASE) {
                    if (data.success) {
                        const purchase = this._paymentsGetPurchasePlatformData(data.data)

                        const mergedPurchase = {
                            id: data.id,
                            ...purchase,
                        }
                        delete mergedPurchase.productId

                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else {
                        this._rejectPromiseDecorator(
                            ACTION_NAME.PURCHASE,
                            new Error(data),
                        )
                    }
                }
            } catch (error) {
                console.error('Error parsing Huawei message:', error)
            }
        }
    }
}

export default HuaweiPlatformBridge
