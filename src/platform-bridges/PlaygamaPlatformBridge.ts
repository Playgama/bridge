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
    type PlatformId,
    type CloudStorageMode,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://playgama.com/platform-sdk/v1.js'

type AdType = 'interstitial' | 'rewarded'
type AdState = 'open' | 'empty' | 'rewarded' | 'close' | 'error' | string

interface PlaygamaPlayer {
    isAuthorized: boolean
    id: string
    name: string
    photos: string[]
    [key: string]: unknown
}

interface PlaygamaPurchase {
    status: string
    orderId?: string
    error?: unknown
    [key: string]: unknown
}

interface PlaygamaProductData extends AnyRecord {
    id: string
    externalId?: string
}

interface PlaygamaSdk {
    platformService: {
        getLanguage(): string
        isReady?: Promise<unknown>
        getIsPaymentsSupported?: () => boolean
        getAdditionalParams?: () => Record<string, unknown> | null
    }
    advService: {
        subscribeToAdStateChanges(callback: (adType: AdType, state: AdState) => void): void
        showInterstitial(): void
        showRewarded(): void
        showAdvancedBanners(banners: unknown): Promise<unknown>
        hideAdvancedBanners(): void
        checkAdBlock(): Promise<boolean>
    }
    userService: {
        getUser(): Promise<PlaygamaPlayer>
        authorizeUser(): Promise<unknown>
    }
    cloudSaveApi: {
        getState(): Promise<AnyRecord>
        setItems(data: AnyRecord): Promise<unknown>
    }
    storageApi: {
        setItems(data: AnyRecord): unknown
        deleteItems(keys: string[]): unknown
    }
    inGamePaymentsApi: {
        purchase(product: PlaygamaProductData): Promise<PlaygamaPurchase>
        getPurchases?: () => Promise<Array<AnyRecord & { id: string }>>
        consumePurchase?: (orderId: string | undefined, externalId: string | undefined) => Promise<unknown>
        confirmDelivery?: (params: { orderId?: string; externalId?: string }) => Promise<unknown>
    }
    gameService: {
        gameReady(): void
    }
}

declare global {
    interface Window {
        PLAYGAMA_SDK?: PlaygamaSdk
    }
}

class PlaygamaPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.PLAYGAMA
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isExternalLinksAllowed(): boolean {
        return false
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return this.#isPaymentsSupported
    }

    get platformLanguage(): string {
        return (this._platformSdk as PlaygamaSdk).platformService.getLanguage() || super.platformLanguage
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    protected _isAdvancedBannersSupported = true

    #isPaymentsSupported = true

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PLAYGAMA_SDK').then(() => {
                    this._platformSdk = window.PLAYGAMA_SDK as PlaygamaSdk;
                    (this._platformSdk as PlaygamaSdk).advService.subscribeToAdStateChanges((adType, state) => {
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

                    const sdk = this._platformSdk as PlaygamaSdk
                    Promise.all([
                        this.#getPlayer(),
                        sdk.platformService?.isReady,
                    ]).then(() => {
                        if (sdk.platformService?.getIsPaymentsSupported) {
                            this.#isPaymentsSupported = sdk.platformService.getIsPaymentsSupported()
                        }
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })

                    if (sdk.platformService.getAdditionalParams) {
                        this._additionalData = sdk.platformService.getAdditionalParams() || {}
                    }
                })
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as PlaygamaSdk).gameService.gameReady()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // storage
    loadCloudSnapshot(): Promise<Record<string, unknown>> {
        return (this._platformSdk as PlaygamaSdk).cloudSaveApi.getState() as Promise<Record<string, unknown>>
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>): Promise<void> {
        return (this._platformSdk as PlaygamaSdk).cloudSaveApi.setItems(snapshot).then(() => undefined)
    }

    deleteCloudKeys(snapshot: Record<string, unknown>): Promise<void> {
        return (this._platformSdk as PlaygamaSdk).cloudSaveApi.setItems(snapshot).then(() => undefined)
    }

    // advertisement
    showInterstitial(): void {
        (this._platformSdk as PlaygamaSdk).advService.showInterstitial()
    }

    showRewarded(): void {
        (this._platformSdk as PlaygamaSdk).advService.showRewarded()
    }

    showAdvancedBanners(banners?: unknown): void {
        this._setAdvancedBannersState(BANNER_STATE.LOADING);
        (this._platformSdk as PlaygamaSdk).advService.showAdvancedBanners(banners)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
            })
    }

    hideAdvancedBanners(): void {
        (this._platformSdk as PlaygamaSdk).advService.hideAdvancedBanners()
        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }

    checkAdBlock(): Promise<boolean> {
        return (this._platformSdk as PlaygamaSdk).advService.checkAdBlock()
    }

    authorizePlayer(options?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this.#getPlayer(options)
                    .then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    })
            } else {
                (this._platformSdk as PlaygamaSdk).userService.authorizeUser()
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
    paymentsPurchase(id: string, options?: { externalId?: string }): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id) as PlaygamaProductData | null
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

            const sdk = this._platformSdk as PlaygamaSdk
            sdk.inGamePaymentsApi.purchase(product)
                .then((purchase) => {
                    if (purchase.status === 'PAID') {
                        const mergedPurchase: AnyRecord & { id: string } = { id, ...purchase }
                        this._paymentsPurchases.push(mergedPurchase)
                        if (sdk.inGamePaymentsApi.confirmDelivery) {
                            sdk.inGamePaymentsApi.confirmDelivery({
                                orderId: purchase.orderId,
                                externalId: mergedPurchase.externalId as string | undefined,
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

    paymentsGetPurchases(): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        const sdk = this._platformSdk as PlaygamaSdk
        if (sdk.inGamePaymentsApi.getPurchases) {
            const promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            sdk.inGamePaymentsApi.getPurchases()
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

    paymentsConsumePurchase(id: string): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        const purchase = this._paymentsPurchases.find((p) => p.id === id) as (AnyRecord & { id: string; orderId?: string; externalId?: string }) | undefined
        if (!purchase) {
            return Promise.reject()
        }

        const sdk = this._platformSdk as PlaygamaSdk
        if (sdk.inGamePaymentsApi.consumePurchase) {
            const promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            sdk.inGamePaymentsApi.consumePurchase(purchase.orderId, purchase.externalId)
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

    paymentsGetCatalog(): Promise<unknown> {
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

    #getPlayer(_options?: unknown): Promise<void> {
        return new Promise<void>((resolve) => {
            (this._platformSdk as PlaygamaSdk).userService.getUser()
                .then((player) => {
                    if (player.isAuthorized) {
                        this._isPlayerAuthorized = true
                        this._playerId = player.id
                        this._playerName = player.name
                        this._playerPhotos = player.photos
                        this._playerExtra = player as unknown as Record<string, unknown>
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
