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

    // payments
    get isPaymentsSupported() {
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

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    #postMessage(action, data) {
        if (!window.system) {
            return
        }

        window.system.postMessage(JSON.stringify({ action, data }))
    }

    #setupHandlers() {
        if (!window.system) {
            return
        }

        const self = this

        window.system.onmessage = (event) => {
            try {
                const { action, data } = JSON.parse(event)

                if (action === ACTION_NAME.INITIALIZE) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.INITIALIZE,
                            new Error(data),
                        )
                        return
                    }

                    self._isInitialized = true
                    self._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
                } else if (action === ACTION_NAME.AUTHORIZE_PLAYER) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.AUTHORIZE_PLAYER,
                            new Error(data),
                        )
                        return
                    }

                    self._playerId = data.playerId
                    self._playerName = data.playerName
                    self._isPlayerAuthorized = true

                    self._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                } else if (action === ACTION_NAME.SET_INTERSTITIAL_STATE) {
                    if (Object.values(INTERSTITIAL_STATE).includes(data.state)) {
                        self._setInterstitialState(
                            data.state,
                            data.state === INTERSTITIAL_STATE.FAILED ? new Error(data) : undefined,
                        )
                    }
                } else if (action === ACTION_NAME.SET_REWARDED_STATE) {
                    if (Object.values(REWARDED_STATE).includes(data.state)) {
                        self._setRewardedState(
                            data.state,
                            data.state === INTERSTITIAL_STATE.FAILED ? new Error(data) : undefined,
                        )
                    }
                } else if (action === ACTION_NAME.GET_CATALOG) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.GET_CATALOG,
                            new Error(data),
                        )
                        return
                    }

                    const products = self._paymentsGetProductsPlatformData()

                    const mergedProducts = products.map((product) => {
                        const huaweiProduct = data.data.find((p) => p.productId === product.id)

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

                    self._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                } else if (action === ACTION_NAME.PURCHASE) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.PURCHASE,
                            new Error(data),
                        )
                        return
                    }

                    const purchase = data.data

                    const mergedPurchase = {
                        id: data.id,
                        ...purchase,
                    }
                    delete mergedPurchase.productId

                    self._paymentsPurchases.push(mergedPurchase)
                    self._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                } else if (action === ACTION_NAME.CONSUME_PURCHASE) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.CONSUME_PURCHASE,
                            new Error(data),
                        )
                        return
                    }

                    const purchaseIndex = self._paymentsPurchases.findIndex(
                        (p) => p.purchaseToken === data.purchaseToken,
                    )

                    if (purchaseIndex >= 0) {
                        self._paymentsPurchases.splice(purchaseIndex, 1)
                    }

                    self._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, data)
                } else if (action === ACTION_NAME.GET_PURCHASES) {
                    if (!data.success) {
                        self._rejectPromiseDecorator(
                            ACTION_NAME.GET_PURCHASES,
                            new Error(data),
                        )
                        return
                    }

                    const products = self._paymentsGetProductsPlatformData()

                    self._paymentsPurchases = data.data.map((unparsedPurchase) => {
                        const purchase = JSON.parse(unparsedPurchase)
                        const product = products.find((p) => p.id === purchase.productId)
                        const mergedPurchase = {
                            id: product.id,
                            ...purchase,
                        }

                        delete mergedPurchase.productId
                        return mergedPurchase
                    })

                    self._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, self._paymentsPurchases)
                }
            } catch (error) {
                console.error('Error parsing Huawei message:', error)
            }
        }
    }
}

export default HuaweiPlatformBridge
