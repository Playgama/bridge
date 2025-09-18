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
    STORAGE_TYPE,
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

    get isExternalLinksAllowed() {
        return true
    }

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    initialize() {
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

    // storage
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

    setDataToStorage(key, value, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.setDataToStorage(key, value, type)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.SET_STORAGE_DATA, { key, value })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(key, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.getDataFromStorage(key, type)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.GET_STORAGE_DATA, key)
        }

        return promiseDecorator.promise
    }

    deleteDataFromStorage(key, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.deleteDataFromStorage(key, type)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.DELETE_STORAGE_DATA, key)
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
                    self.#initialize(data)
                } else if (action === ACTION_NAME.AUTHORIZE_PLAYER) {
                    self.#authorizePlayer(data)
                } else if (action === ACTION_NAME.SET_INTERSTITIAL_STATE) {
                    self.#setInterstitialState(data)
                } else if (action === ACTION_NAME.SET_REWARDED_STATE) {
                    self.#setRewardedState(data)
                } else if (action === ACTION_NAME.GET_CATALOG) {
                    self.#getCatalog(data)
                } else if (action === ACTION_NAME.PURCHASE) {
                    self.#purchase(data)
                } else if (action === ACTION_NAME.CONSUME_PURCHASE) {
                    self.#consumePurchase(data)
                } else if (action === ACTION_NAME.GET_PURCHASES) {
                    self.#getPurchases(data)
                } else if (action === ACTION_NAME.GET_STORAGE_DATA) {
                    self.#getStorageData(data)
                } else if (action === ACTION_NAME.SET_STORAGE_DATA) {
                    self.#setStorageData(data)
                } else if (action === ACTION_NAME.DELETE_STORAGE_DATA) {
                    self.#deleteStorageData(data)
                }
            } catch (error) {
                console.error('Error parsing Huawei message:', error)
            }
        }
    }

    #initialize(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.INITIALIZE,
                new Error(data),
            )
            return
        }

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
    }

    #authorizePlayer(data) {
        if (!data.success) {
            this._playerApplyGuestData()
            this._rejectPromiseDecorator(
                ACTION_NAME.AUTHORIZE_PLAYER,
                new Error(data),
            )
            return
        }

        this._playerId = data.playerId
        this._playerName = data.playerName
        this._isPlayerAuthorized = true

        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
    }

    // advertisement
    #setInterstitialState(data) {
        if (Object.values(INTERSTITIAL_STATE).includes(data.state)) {
            this._setInterstitialState(
                data.state,
                data.state === INTERSTITIAL_STATE.FAILED ? new Error(data) : undefined,
            )
        }
    }

    #setRewardedState(data) {
        if (Object.values(REWARDED_STATE).includes(data.state)) {
            this._setRewardedState(
                data.state,
                data.state === REWARDED_STATE.FAILED ? new Error(data) : undefined,
            )
        }
    }

    // payments
    #getCatalog(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_CATALOG,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()

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

        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
    }

    #purchase(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
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

        this._paymentsPurchases.push(mergedPurchase)
        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
    }

    #consumePurchase(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.CONSUME_PURCHASE,
                new Error(data),
            )
            return
        }

        const purchaseIndex = this._paymentsPurchases.findIndex(
            (p) => p.purchaseToken === data.purchaseToken,
        )

        if (purchaseIndex >= 0) {
            this._paymentsPurchases.splice(purchaseIndex, 1)
        }

        this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, data)
    }

    #getPurchases(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_PURCHASES,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()

        this._paymentsPurchases = data.data.map((unparsedPurchase) => {
            const purchase = JSON.parse(unparsedPurchase)
            const product = products.find((p) => p.id === purchase.productId)
            const mergedPurchase = {
                id: product.id,
                ...purchase,
            }

            delete mergedPurchase.productId
            return mergedPurchase
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
    }

    // storage
    #getStorageData(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, data.data)
    }

    #setStorageData(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.SET_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA, data.data)
    }

    #deleteStorageData(data) {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.DELETE_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA, data.data)
    }
}

export default HuaweiPlatformBridge
