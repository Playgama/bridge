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
import { ACTION_NAME, type ActionName } from '../constants'
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
import type { PostLaunchOptions } from '../modules/social/types'

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

interface PlaygamaCatalogProduct {
    id: string
    // charge terms the platform expects back on purchase (fiat in minor units)
    amount?: number
    currency?: string
    price: string
    priceValue: number
    priceCurrencyCode: string
    priceCurrencyImage?: string
}

// Room invite the portal turns into a link to the game with the room code.
interface PlaygamaRoomInvite extends AnyRecord {
    roomId: string
    type: string
}

// The room the player is in, reported to the portal on every change.
interface PlaygamaRoomStatus {
    id: string
    type: string
    maxPlayers: number
    playerCount: number
    isOpen: boolean
    isVisible: boolean
}

interface PlaygamaSdk {
    platformService: {
        getLanguage(): string
        isReady?: Promise<unknown>
        getIsPaymentsSupported?: () => boolean
        getIsPlayerAuthorizationSupported?: () => boolean
        getIsCloudSaveSupported?: () => boolean
        getAdditionalParams?: () => Record<string, unknown> | null
        // Payload of the link the game was opened with (createPost / share), see platform.payload.
        getPayload?: () => string | null
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
        getCatalog?: (products: PlaygamaProductData[]) => Promise<PlaygamaCatalogProduct[]>
        getPurchases?: () => Promise<Array<AnyRecord & { id: string; bridgeId?: string }>>
        consumePurchase?: (orderId: string | undefined, externalId: string | undefined) => Promise<unknown>
        confirmDelivery?: (params: { orderId?: string; externalId?: string }) => Promise<unknown>
    }
    gameService: {
        gameReady(): void
        sendMessage?: (message: string, options?: AnyRecord) => unknown
    }
    // Every method is optional: the bridge reports a feature as supported once the
    // portal SDK has its method, unless the matching getIs...Supported() returns false.
    socialService?: {
        getIsShareSupported?: () => boolean
        share?: (options?: AnyRecord) => Promise<unknown>
        getIsInviteFriendsSupported?: () => boolean
        inviteFriends?: (options?: AnyRecord) => Promise<unknown>
        getIsJoinCommunitySupported?: () => boolean
        joinCommunity?: (options?: AnyRecord) => Promise<unknown>
        getIsCreatePostSupported?: () => boolean
        createPost?: (options?: AnyRecord, post?: PostLaunchOptions) => Promise<unknown>
        getIsAddToHomeScreenSupported?: () => boolean
        addToHomeScreen?: () => Promise<unknown>
        getIsAddToHomeScreenRewardSupported?: () => boolean
        getAddToHomeScreenReward?: () => Promise<unknown>
        getIsAddToFavoritesSupported?: () => boolean
        addToFavorites?: () => Promise<unknown>
        getIsAddToFavoritesRewardSupported?: () => boolean
        getAddToFavoritesReward?: () => Promise<unknown>
        getIsRateSupported?: () => boolean
        rate?: () => Promise<unknown>
    }
    multiplayerService?: {
        getIsInviteToRoomSupported?: () => boolean
        inviteToRoom?: (invite: PlaygamaRoomInvite) => Promise<unknown>
        // Room code of the invite link the game was opened with.
        getLaunchRoomId?: () => string | null
        setCurrentRoom?: (room: PlaygamaRoomStatus | null) => void
    }
}

type PlaygamaService = Record<string, unknown> | undefined

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
    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    get isShareSupported(): boolean {
        return this.#isSupported(this.#socialService, 'share', 'getIsShareSupported')
    }

    get isInviteFriendsSupported(): boolean {
        return this.#isSupported(this.#socialService, 'inviteFriends', 'getIsInviteFriendsSupported')
    }

    get isJoinCommunitySupported(): boolean {
        return this.#isSupported(this.#socialService, 'joinCommunity', 'getIsJoinCommunitySupported')
    }

    get isCreatePostSupported(): boolean {
        return this.#isSupported(this.#socialService, 'createPost', 'getIsCreatePostSupported')
    }

    get isAddToHomeScreenSupported(): boolean {
        return this.#isSupported(this.#socialService, 'addToHomeScreen', 'getIsAddToHomeScreenSupported')
    }

    get isAddToHomeScreenRewardSupported(): boolean {
        return this.#isSupported(
            this.#socialService,
            'getAddToHomeScreenReward',
            'getIsAddToHomeScreenRewardSupported',
        )
    }

    get isAddToFavoritesSupported(): boolean {
        return this.#isSupported(this.#socialService, 'addToFavorites', 'getIsAddToFavoritesSupported')
    }

    get isAddToFavoritesRewardSupported(): boolean {
        return this.#isSupported(
            this.#socialService,
            'getAddToFavoritesReward',
            'getIsAddToFavoritesRewardSupported',
        )
    }

    get isRateSupported(): boolean {
        return this.#isSupported(this.#socialService, 'rate', 'getIsRateSupported')
    }

    // multiplayer
    get isMultiplayerRoomInviteSupported(): boolean {
        return this.#isSupported(this.#multiplayerService, 'inviteToRoom', 'getIsInviteToRoomSupported')
    }

    get multiplayerLaunchRoomId(): string | null {
        return this.#getValue(this.#multiplayerService, 'getLaunchRoomId')
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

    get platformPayload(): string | null {
        const platformService = (this._platformSdk as PlaygamaSdk | null)?.platformService as PlaygamaService
        return this.#getValue(platformService, 'getPayload') ?? super.platformPayload
    }

    protected _isAdvancedBannersSupported = true

    #isPaymentsSupported = true

    #isCloudSaveSupported = true

    #isPlayerAuthorizationSupported = true

    // Catalog entries accepted from the platform supply the displayed purchase terms.
    #paymentsPlatformCatalog = new Map<string, PlaygamaCatalogProduct>()

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
                                this._data = sdk.platformService.getAdditionalParams() || {}
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
    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as PlaygamaSdk).gameService?.gameReady?.()
                return Promise.resolve()
            }
            default: {
                (this._platformSdk as PlaygamaSdk).gameService?.sendMessage?.(String(message), (options ?? {}) as AnyRecord)
                return super.sendMessage(message, options)
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

        product.bridgeId = id

        const accepted = this.#paymentsPlatformCatalog.get(id)
        const request = typeof accepted?.amount === 'number' && accepted.currency
            ? { ...product, amount: accepted.amount, currency: accepted.currency }
            : product

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const sdk = this._platformSdk as PlaygamaSdk
            sdk.inGamePaymentsApi.purchase(request)
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

    async paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData() as PlaygamaProductData[]
        if (!products) {
            return Promise.reject()
        }

        const platformCatalog = await this.#paymentsGetPlatformCatalog(products)
        if (platformCatalog !== null) {
            this.#paymentsPlatformCatalog = new Map(platformCatalog.map((product) => [product.id, product]))
        }

        return products.map((product) => {
            const platformProduct = this.#paymentsPlatformCatalog.get(product.id)
            return platformProduct
                ? {
                    id: product.id,
                    price: platformProduct.price,
                    priceValue: platformProduct.priceValue,
                    priceCurrencyCode: platformProduct.priceCurrencyCode,
                    ...(platformProduct.priceCurrencyImage === undefined
                        ? {} : { priceCurrencyImage: platformProduct.priceCurrencyImage }),
                }
                : this.#paymentsGetFallbackCatalogProduct(product)
        })
    }

    // social
    share(options?: AnyRecord): Promise<unknown> {
        return this.#call(this.#socialService, 'share', ACTION_NAME.SHARE, options)
    }

    inviteFriends(options?: AnyRecord): Promise<unknown> {
        return this.#call(this.#socialService, 'inviteFriends', ACTION_NAME.INVITE_FRIENDS, options)
    }

    joinCommunity(options?: AnyRecord): Promise<unknown> {
        return this.#call(this.#socialService, 'joinCommunity', ACTION_NAME.JOIN_COMMUNITY, options)
    }

    createPost(options?: AnyRecord, post?: PostLaunchOptions): Promise<unknown> {
        return this.#call(this.#socialService, 'createPost', ACTION_NAME.CREATE_POST, options, post)
    }

    addToHomeScreen(): Promise<unknown> {
        return this.#call(this.#socialService, 'addToHomeScreen', ACTION_NAME.ADD_TO_HOME_SCREEN)
    }

    getAddToHomeScreenReward(): Promise<unknown> {
        return this.#call(
            this.#socialService,
            'getAddToHomeScreenReward',
            ACTION_NAME.GET_ADD_TO_HOME_SCREEN_REWARD,
        )
    }

    addToFavorites(): Promise<unknown> {
        return this.#call(this.#socialService, 'addToFavorites', ACTION_NAME.ADD_TO_FAVORITES)
    }

    getAddToFavoritesReward(): Promise<unknown> {
        return this.#call(this.#socialService, 'getAddToFavoritesReward', ACTION_NAME.GET_ADD_TO_FAVORITES_REWARD)
    }

    rate(): Promise<unknown> {
        return this.#call(this.#socialService, 'rate', ACTION_NAME.RATE)
    }

    // multiplayer
    multiplayerInviteToRoom(invite: PlaygamaRoomInvite): Promise<unknown> {
        return this.#call(this.#multiplayerService, 'inviteToRoom', ACTION_NAME.INVITE_TO_ROOM, invite)
    }

    notifyMultiplayerRoomChanged(room: PlaygamaRoomStatus | null): void {
        const multiplayerService = this.#multiplayerService
        if (typeof multiplayerService?.setCurrentRoom !== 'function') {
            return
        }

        try {
            multiplayerService.setCurrentRoom(room)
        } catch {
            // the room status is informational for the portal
        }
    }

    // Rejected SDK calls keep the last displayed prices and their charge terms.
    // An empty response (including portal quote failures) replaces them with GAM fallback prices.
    async #paymentsGetPlatformCatalog(products: PlaygamaProductData[]): Promise<PlaygamaCatalogProduct[] | null> {
        const paymentsApi = (this._platformSdk as PlaygamaSdk | null)?.inGamePaymentsApi
        if (typeof paymentsApi?.getCatalog !== 'function') {
            return null
        }

        try {
            const catalog = await paymentsApi.getCatalog(products)
            return Array.isArray(catalog) ? catalog.filter((product) => typeof product?.id === 'string') : null
        } catch {
            return null
        }
    }

    #paymentsGetFallbackCatalogProduct(product: PlaygamaProductData): PlaygamaCatalogProduct {
        const amount = product.amount as number
        return {
            id: product.id,
            price: `${amount} Gam`,
            priceCurrencyCode: 'Gam',
            priceCurrencyImage: 'https://games.playgama.com/assets/gold-fennec-coin-large.webp',
            priceValue: amount,
        }
    }

    #getPlayer(_options?: unknown): Promise<void> {
        const sdk = this._platformSdk as PlaygamaSdk
        if (typeof sdk.userService?.getUser !== 'function') {
            this._playerApplyGuestData()
            return Promise.resolve()
        }

        return new Promise<void>((resolve) => {
            sdk.userService.getUser()
                .then((player) => {
                    // The SDK id is used even for unauthorized players;
                    // without it the locally generated guest id stays in place.
                    if (player.id) {
                        this._playerId = player.id
                    }

                    if (player.isAuthorized) {
                        this._isPlayerAuthorized = true
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

        this._setPlatformStorageAvailable(this.#isCloudSaveSupported)

        if (sdk.platformService?.getIsPaymentsSupported) {
            this.#isPaymentsSupported = sdk.platformService.getIsPaymentsSupported()
        }
    }

    get #socialService(): PlaygamaService {
        return (this._platformSdk as PlaygamaSdk | null)?.socialService as PlaygamaService
    }

    get #multiplayerService(): PlaygamaService {
        return (this._platformSdk as PlaygamaSdk | null)?.multiplayerService as PlaygamaService
    }

    // A feature is supported once the portal SDK has its method, unless its
    // support getter says otherwise, so games get a feature as soon as the portal ships it.
    #isSupported(service: PlaygamaService, method: string, supportGetter: string): boolean {
        if (typeof service?.[method] !== 'function') {
            return false
        }

        if (typeof service[supportGetter] !== 'function') {
            return true
        }

        try {
            return Boolean((service[supportGetter] as () => unknown).call(service))
        } catch {
            return false
        }
    }

    #getValue(service: PlaygamaService, getter: string): string | null {
        if (typeof service?.[getter] !== 'function') {
            return null
        }

        try {
            const value = (service[getter] as () => unknown).call(service)
            return typeof value === 'string' && value ? value : null
        } catch {
            return null
        }
    }

    // Calls an optional portal SDK method; a missing method, a throw or a rejection rejects.
    #call(service: PlaygamaService, method: string, actionName: ActionName, ...args: unknown[]): Promise<unknown> {
        if (typeof service?.[method] !== 'function') {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(actionName)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(actionName)

            new Promise((resolve) => {
                resolve((service[method] as (...params: unknown[]) => unknown).apply(service, args))
            })
                .then((result) => {
                    this._resolvePromiseDecorator(actionName, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(actionName, error)
                })
        }

        return promiseDecorator.promise
    }

    #ensureStorageReady(): Promise<void> {
        if (!this.#isCloudSaveSupported) {
            return Promise.reject()
        }
        return Promise.resolve()
    }
}

export default PlaygamaPlatformBridge
