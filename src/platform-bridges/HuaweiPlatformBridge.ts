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
    type PlatformId,
    type StorageType,
    type InterstitialState,
    type RewardedState,
} from '../constants'
import { postToSystem } from '../common/utils'
import type { AnyRecord } from '../types/common'

interface HuaweiSystem {
    onmessage: ((event: string) => void) | null
    postMessage(message: unknown): void
}

declare global {
    interface Window {
        system?: HuaweiSystem
    }
}

class HuaweiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.HUAWEI
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    get isExternalLinksAllowed(): boolean {
        return true
    }

    protected _defaultStorageType: StorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    #appId: string | null = null

    initialize(): Promise<unknown> {
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
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this.#appId = this._options.appId as string

                this.#setupHandlers()

                this.#postMessage(ACTION_NAME.INITIALIZE, this.#appId)
            }
        }

        return promiseDecorator.promise
    }

    authorizePlayer(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this.#postMessage(ACTION_NAME.AUTHORIZE_PLAYER)
        }

        return promiseDecorator.promise
    }

    // storage
    setDataToStorage(key: string | string[], value: unknown | unknown[], type: StorageType): Promise<void> {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.setDataToStorage(key, value, type)
        }

        let promiseDecorator = this._getPromiseDecorator<void>(ACTION_NAME.SET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator<void>(ACTION_NAME.SET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.SET_STORAGE_DATA, { key, value })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(key: string | string[], type: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.getDataFromStorage(key, type, tryParseJson)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.GET_STORAGE_DATA, key)
        }

        return promiseDecorator.promise
    }

    deleteDataFromStorage(key: string | string[], type: StorageType): Promise<void> {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.deleteDataFromStorage(key, type)
        }

        let promiseDecorator = this._getPromiseDecorator<void>(ACTION_NAME.DELETE_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator<void>(ACTION_NAME.DELETE_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.DELETE_STORAGE_DATA, key)
        }

        return promiseDecorator.promise
    }

    // advertisement
    showInterstitial(placementId?: unknown): void {
        this.#postMessage(ACTION_NAME.SHOW_INTERSTITIAL, placementId)
    }

    showRewarded(placementId?: unknown): void {
        this.#postMessage(ACTION_NAME.SHOW_REWARDED, placementId)
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
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

    paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this.#postMessage(
                ACTION_NAME.CONSUME_PURCHASE,
                this._paymentsPurchases[purchaseIndex].purchaseToken,
            )
        }
        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
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

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    #postMessage(action: string, data?: unknown): void {
        postToSystem(JSON.stringify({ action, data }))
    }

    #setupHandlers(): void {
        if (!window.system) {
            return
        }

        window.system.onmessage = (event: string) => {
            try {
                const { action, data } = JSON.parse(event) as { action: string; data: Record<string, unknown> }

                if (action === ACTION_NAME.INITIALIZE) {
                    this.#initialize(data)
                } else if (action === ACTION_NAME.AUTHORIZE_PLAYER) {
                    this.#authorizePlayer(data)
                } else if (action === ACTION_NAME.SET_INTERSTITIAL_STATE) {
                    this.#setInterstitialState(data)
                } else if (action === ACTION_NAME.SET_REWARDED_STATE) {
                    this.#setRewardedState(data)
                } else if (action === ACTION_NAME.GET_CATALOG) {
                    this.#getCatalog(data)
                } else if (action === ACTION_NAME.PURCHASE) {
                    this.#purchase(data)
                } else if (action === ACTION_NAME.CONSUME_PURCHASE) {
                    this.#consumePurchase(data)
                } else if (action === ACTION_NAME.GET_PURCHASES) {
                    this.#getPurchases(data)
                } else if (action === ACTION_NAME.GET_STORAGE_DATA) {
                    this.#getStorageData(data)
                } else if (action === ACTION_NAME.SET_STORAGE_DATA) {
                    this.#setStorageData(data)
                } else if (action === ACTION_NAME.DELETE_STORAGE_DATA) {
                    this.#deleteStorageData(data)
                }
            } catch (error) {
                console.error('Error parsing Huawei message:', error)
            }
        }
    }

    #initialize(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.INITIALIZE,
                new Error(String(data)),
            )
            return
        }

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
    }

    #authorizePlayer(data: Record<string, unknown>): void {
        if (!data.success) {
            this._playerApplyGuestData()
            this._rejectPromiseDecorator(
                ACTION_NAME.AUTHORIZE_PLAYER,
                new Error(String(data)),
            )
            return
        }

        this._playerId = data.playerId as string
        this._playerName = data.playerName as string
        this._isPlayerAuthorized = true

        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
    }

    // advertisement
    #setInterstitialState(data: Record<string, unknown>): void {
        const state = data.state as InterstitialState
        if ((Object.values(INTERSTITIAL_STATE) as string[]).includes(state)) {
            if (state === INTERSTITIAL_STATE.FAILED) {
                this._showAdFailurePopup(false)
            } else {
                this._setInterstitialState(state)
            }
        }
    }

    #setRewardedState(data: Record<string, unknown>): void {
        const state = data.state as RewardedState
        if ((Object.values(REWARDED_STATE) as string[]).includes(state)) {
            if (state === REWARDED_STATE.FAILED) {
                this._showAdFailurePopup(true)
            } else {
                this._setRewardedState(state)
            }
        }
    }

    // payments
    #getCatalog(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_CATALOG,
                new Error(String(data)),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()
        const huaweiProducts = (data.data as AnyRecord[] | undefined) ?? []

        const mergedProducts = products.map((product) => {
            const huaweiProduct = huaweiProducts.find((p) => p.productId === product.id) as AnyRecord

            return {
                id: product.id,
                title: huaweiProduct.productName,
                description: huaweiProduct.productDesc,
                price: huaweiProduct.price,
                priceCurrencyCode: huaweiProduct.currency,
                priceValue: (huaweiProduct.microsPrice as number) * 0.000001,
                subSpecialPeriodCycles: huaweiProduct.subSpecialPeriodCycles,
                subProductLevel: huaweiProduct.subProductLevel,
                priceType: huaweiProduct.priceType,
            }
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
    }

    #purchase(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.PURCHASE,
                new Error(String(data)),
            )
            return
        }

        const purchase = data.data as AnyRecord

        const mergedPurchase: AnyRecord = {
            id: data.id as string,
            ...purchase,
        }
        delete mergedPurchase.productId

        this._paymentsPurchases.push(mergedPurchase as AnyRecord & { id: string })
        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
    }

    #consumePurchase(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.CONSUME_PURCHASE,
                new Error(String(data)),
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

    #getPurchases(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_PURCHASES,
                new Error(String(data)),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()
        const rawPurchases = (data.data as string[] | undefined) ?? []

        this._paymentsPurchases = rawPurchases.map((unparsedPurchase) => {
            const purchase = JSON.parse(unparsedPurchase) as AnyRecord
            const product = products.find((p) => p.id === purchase.productId)
            const mergedPurchase: AnyRecord = {
                id: product?.id as string,
                ...purchase,
            }

            delete mergedPurchase.productId
            return mergedPurchase as AnyRecord & { id: string }
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
    }

    // storage
    #getStorageData(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_STORAGE_DATA,
                new Error(String(data)),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, data.data)
    }

    #setStorageData(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.SET_STORAGE_DATA,
                new Error(String(data)),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA, data.data)
    }

    #deleteStorageData(data: Record<string, unknown>): void {
        if (!data.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.DELETE_STORAGE_DATA,
                new Error(String(data)),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA, data.data)
    }
}

export default HuaweiPlatformBridge
