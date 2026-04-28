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
    ACTION_NAME,
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    type PlatformId,
    type StorageType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://storage.googleapis.com/social-networth/scripts/sdk.umd.js'

interface PortalSdk {
    getLocale(): string
    initialize(): Promise<unknown>
    initializeOverlay(): void
    getValue(key: string): unknown
    setValue(key: string, value: unknown): unknown
    removeValue(key: string): unknown
    requestAd(): Promise<unknown>
    requestRewardAd(): Promise<boolean>
    gameReady(): void
    getShopItems(): Promise<AnyRecord[]>
    openPurchaseConfirmModal(item: AnyRecord): Promise<AnyRecord>
    getPurchasedShopItems(): Promise<AnyRecord[]>
}

declare global {
    interface Window {
        PortalSDK?: PortalSdk
    }
}

class PortalPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.PORTAL
    }

    get isPaymentsSupported(): boolean {
        return true
    }

    get platformLanguage(): string {
        return (this._platformSdk as PortalSdk).getLocale() || super.platformLanguage
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PortalSDK').then(() => {
                    this._platformSdk = window.PortalSDK as PortalSdk;
                    (this._platformSdk as PortalSdk).initialize()
                        .then(() => {
                            (this._platformSdk as PortalSdk).initializeOverlay()

                            this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                        .catch((e) => {
                            this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e)
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as PortalSdk
            if (Array.isArray(key)) {
                const promises = key.map((k) => Promise.resolve(sdk.getValue(k)).then((rawValue) => {
                    let parsedValue = rawValue
                    if (tryParseJson && typeof rawValue === 'string') {
                        try {
                            parsedValue = JSON.parse(rawValue)
                        } catch {
                            // keep as-is
                        }
                    }
                    return parsedValue
                }))

                return Promise.all(promises)
            }

            return Promise.resolve(sdk.getValue(key)).then((rawValue) => {
                let parsedValue = rawValue
                if (tryParseJson && typeof rawValue === 'string') {
                    try {
                        parsedValue = JSON.parse(rawValue)
                    } catch {
                        // keep as-is
                    }
                }
                return parsedValue
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as PortalSdk
            if (Array.isArray(key)) {
                const values = value as unknown[]
                const promises = key.map((k, i) => Promise.resolve(sdk.setValue(k, values[i])))
                return Promise.all(promises).then(() => undefined)
            }
            return Promise.resolve(sdk.setValue(key, value)).then(() => undefined)
        }
        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as PortalSdk
            if (Array.isArray(key)) {
                const promises = key.map((k) => Promise.resolve(sdk.removeValue(k)))
                return Promise.all(promises).then(() => undefined)
            }
            return Promise.resolve(sdk.removeValue(key)).then(() => undefined)
        }
        return super.deleteDataFromStorage(key, storageType)
    }

    showInterstitial(): void {
        (this._platformSdk as PortalSdk).requestAd()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(): void {
        (this._platformSdk as PortalSdk).requestRewardAd()
            .then((success) => {
                if (success) {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                } else {
                    this._showAdFailurePopup(true)
                }
            })
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as PortalSdk).gameReady()
                return Promise.resolve()
            }
            default:
                return super.sendMessage(message, options)
        }
    }

    paymentsPurchase(id: string): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const platformProductId = product?.id as string
            const sdk = this._platformSdk as PortalSdk

            Promise.resolve(sdk.getShopItems())
                .then((catalog) => {
                    const catalogProduct = catalog.find((x) => x && x.id === platformProductId)
                    if (!catalogProduct) {
                        throw new Error('Shop item not found in catalog')
                    }

                    return sdk.openPurchaseConfirmModal(catalogProduct)
                })
                .then((purchase) => {
                    if (purchase && (purchase.status === 'success')) {
                        const mergedPurchase = {
                            id,
                            ...purchase,
                        }
                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else {
                        throw new Error('Purchase failed')
                    }
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products || !Array.isArray(products) || products.length === 0) {
            return Promise.reject(new Error('No platform products available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)
            const sdk = this._platformSdk as PortalSdk

            Promise.resolve(sdk.getShopItems())
                .then((catalog) => {
                    if (!Array.isArray(catalog)) {
                        throw new Error('Catalog response is not an array')
                    }

                    const mergedProducts = products
                        .map((product) => {
                            const platformId = product.id
                            const catalogProduct = catalog.find((p) => p && p.id === platformId)

                            if (!catalogProduct) {
                                return null
                            }

                            return {
                                id: product.id,
                                name: catalogProduct.name,
                                price: `${catalogProduct.price} Gems`,
                                priceCurrencyCode: 'Gems',
                                priceValue: catalogProduct.price,
                            }
                        })
                        .filter(Boolean)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)
            const sdk = this._platformSdk as PortalSdk

            Promise.resolve(sdk.getPurchasedShopItems())
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const platformProductId = purchase.id
                        const product = products.find((p) => p.id === platformProductId)
                        if (!product) {
                            return null
                        }

                        const mergedPurchase = {
                            id: product.id as string,
                            ...purchase,
                        }

                        return mergedPurchase
                    }).filter((p): p is AnyRecord & { id: string } => p !== null)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }
}

export default PortalPlatformBridge
