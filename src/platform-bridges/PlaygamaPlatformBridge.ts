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
import { addJavaScript, waitFor, type AnyRecord } from '../utils'
import { ACTION_NAME } from '../constants'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    type PlatformId,
} from '../modules/platform/constants'
import {
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../modules/advertisement/constants'
import type { WriteBatch } from '../modules/storage/types'

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
    bridgeId?: string
}

interface PlaygamaSdk {
    platformService: {
        getLanguage(): string
        isReady?: Promise<unknown>
        getIsPaymentsSupported?: () => boolean
        getIsPlayerAuthorizationSupported?: () => boolean
        getIsCloudSaveSupported?: () => boolean
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
    storageApi?: {
        setItems?(data: AnyRecord): unknown
        deleteItems?(keys: string[]): unknown
    }
    inGamePaymentsApi: {
        purchase(product: PlaygamaProductData): Promise<PlaygamaPurchase>
        getPurchases?: () => Promise<Array<AnyRecord & { id: string; bridgeId?: string }>>
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

    get sdkUrl(): string {
        return 'https://playgama.com/platform-sdk/v1.js'
    }

    get sdkGlobalName(): string {
        return 'PLAYGAMA_SDK'
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
        return this.#isPlayerAuthorizationSupported
    }

    // payments
    get isPaymentsSupported(): boolean {
        return this.#isPaymentsSupported
    }

    get platformLanguage(): string {
        return (this._platformSdk as PlaygamaSdk | null)?.platformService?.getLanguage?.() || super.platformLanguage
    }

    protected _isAdvancedBannersSupported = true

    #isPaymentsSupported = true

    #isCloudSaveSupported = true

    #isPlayerAuthorizationSupported = true

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(this.sdkUrl).then(() => {
                waitFor(this.sdkGlobalName).then(() => {
                    const globalScope = window as unknown as Record<string, unknown>
                    this._platformSdk = globalScope[this.sdkGlobalName] as PlaygamaSdk;
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
                    const platformReadyPromise = sdk.platformService?.isReady ?? Promise.resolve()
                    platformReadyPromise
                        .then(() => {
                            this.#resolveSupportedFeatures()

                            if (sdk.platformService?.getAdditionalParams) {
                                this._additionalData = sdk.platformService.getAdditionalParams() || {}
                            }

                            return this.#getPlayer()
                        })
                        .then(() => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as PlaygamaSdk).gameService?.gameReady?.()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // storage
    async getDataFromStorage(): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        return (this._platformSdk as PlaygamaSdk).cloudSaveApi.getState() as Promise<Record<string, unknown>>
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        const snapshot = await (this._platformSdk as PlaygamaSdk).cloudSaveApi.getState() as Record<string, unknown>
        Object.keys(data).forEach((key) => { snapshot[key] = data[key] })
        await (this._platformSdk as PlaygamaSdk).cloudSaveApi.setItems(snapshot)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        const snapshot = await (this._platformSdk as PlaygamaSdk).cloudSaveApi.getState() as Record<string, unknown>
        keys.forEach((key) => { delete snapshot[key] })
        await (this._platformSdk as PlaygamaSdk).cloudSaveApi.setItems(snapshot)
    }

    // Mirror guest/local writes to Playgama's server-side storage (write-only backup, best-effort).
    notifyLocalDataChanged(batch: WriteBatch): void {
        const storageApi = (this._platformSdk as PlaygamaSdk | null)?.storageApi
        if (!storageApi) {
            return
        }

        if (batch.sets.length > 0) {
            const data: Record<string, unknown> = {}
            batch.sets.forEach((entry) => { data[entry.key] = entry.value })
            storageApi.setItems?.(data)
        }

        if (batch.deletes.length > 0) {
            storageApi.deleteItems?.(batch.deletes)
        }
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
        if (!this.#isPlayerAuthorizationSupported) {
            return Promise.reject()
        }

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
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

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

        product.bridgeId = id

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
                    this._paymentsPurchases = purchases.map(({ bridgeId, ...purchase }) => (
                        bridgeId ? { ...purchase, id: bridgeId } : purchase
                    ))
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
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

        type PurchaseRecord = AnyRecord & { id: string; orderId?: string; externalId?: string }
        const purchase = this._paymentsPurchases.find((p) => p.id === id) as PurchaseRecord | undefined
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
        if (!this.#isPlayerAuthorizationSupported) {
            this._playerApplyGuestData()
            return Promise.resolve()
        }

        return new Promise<void>((resolve) => {
            (this._platformSdk as PlaygamaSdk).userService.getUser()
                .then((player) => {
                    if (player.isAuthorized) {
                        this._isPlayerAuthorized = true
                        this._playerId = player.id
                        this._playerName = player.name
                        this._playerPhotos = player.photos
                        this._playerExtra = player as unknown as Record<string, unknown>
                        if (this.#isCloudSaveSupported) {
                            this._setPlatformStorageAvailable(true)
                        }
                    }
                })
                .catch(() => {})
                .finally(() => {
                    resolve()
                })
        })
    }

    #resolveSupportedFeatures(): void {
        const sdk = this._platformSdk as PlaygamaSdk
        if (sdk.platformService?.getIsPlayerAuthorizationSupported) {
            this.#isPlayerAuthorizationSupported = sdk.platformService.getIsPlayerAuthorizationSupported()
        }

        if (sdk.platformService?.getIsCloudSaveSupported) {
            this.#isCloudSaveSupported = sdk.platformService.getIsCloudSaveSupported()
        }

        if (sdk.platformService?.getIsPaymentsSupported) {
            this.#isPaymentsSupported = sdk.platformService.getIsPaymentsSupported()
        }
    }

    #ensureStorageReady(): Promise<void> {
        if (!this.#isCloudSaveSupported || !this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }
}

export default PlaygamaPlatformBridge
