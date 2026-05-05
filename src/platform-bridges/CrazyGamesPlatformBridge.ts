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
    addJavaScript,
    createAdvertisementBannerContainer,
    createAdvancedBannerContainers,
    removeAdvancedBannerContainers,
    waitFor,
} from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
    BANNER_CONTAINER_ID,
    type PlatformId,
    type CloudStorageMode,
    type DeviceType,
} from '../constants'
import type { AnyRecord, AdvancedBannerConfig } from '../types/common'

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
const XSOLLA_PAYSTATION_EMBED_URL = 'https://cdn.xsolla.net/payments-bucket-prod/embed/1.5.0/widget.min.js'
const XSOLLA_SDK_URL = 'https://store.xsolla.com/api/v2/project'

interface CrazyGamesUser {
    username?: string
    profilePictureUrl?: string
    [key: string]: unknown
}

interface CrazyGamesAdCallbacks {
    adStarted: () => void
    adFinished: () => void
    adError: () => void
}

interface CrazyGamesSdk {
    init(): Promise<unknown>
    user: {
        isUserAccountAvailable: boolean
        systemInfo: {
            countryCode: string
            device: { type: string }
        }
        getUser(): Promise<CrazyGamesUser | null>
        getUserToken(): Promise<string>
        getXsollaUserToken(): Promise<string>
        showAuthPrompt(): Promise<unknown>
    }
    data: {
        getItem(key: string): string | null
        setItem(key: string, value: string): void
        removeItem(key: string): void
    }
    banner: {
        requestResponsiveBanner(containers: string | string[]): Promise<unknown>
        clearAllBanners(): void
    }
    ad: {
        requestAd(type: string, callbacks: CrazyGamesAdCallbacks): void
        hasAdblock(): Promise<boolean>
    }
    game: {
        loadingStart(): void
        loadingStop(): void
        gameplayStart(): void
        gameplayStop(): void
        happytime(): void
    }
    analytics: {
        trackOrder(provider: string, order: AnyRecord): void
    }
}

interface XsollaPayStation {
    init(config: AnyRecord): void
    on(event: string, callback: (...args: unknown[]) => void): void
    open(): void
    eventTypes: { STATUS: string; [key: string]: string }
}

declare global {
    interface Window {
        CrazyGames?: { SDK: CrazyGamesSdk }
        XPayStationWidget?: XsollaPayStation
    }
}

class CrazyGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.CRAZY_GAMES
    }

    get platformLanguage(): string {
        if (this.#isUserAccountAvailable) {
            return (this._platformSdk as CrazyGamesSdk).user.systemInfo.countryCode.toLowerCase()
        }

        return super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return this.#isUserAccountAvailable
    }

    get isPaymentsSupported(): boolean {
        if (this.options.xsollaProjectId) {
            return true
        }

        return false
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.LAZY
    }

    get cloudStorageReady(): Promise<void> {
        return Promise.resolve()
    }

    // device
    get deviceType(): DeviceType {
        if (this.#isUserAccountAvailable) {
            const userDeviceType = (this._platformSdk as CrazyGamesSdk).user.systemInfo.device.type.toLowerCase()
            const supported: DeviceType[] = [
                DEVICE_TYPE.DESKTOP,
                DEVICE_TYPE.MOBILE,
                DEVICE_TYPE.TABLET,
            ]
            if (supported.includes(userDeviceType as DeviceType)) {
                return userDeviceType as DeviceType
            }
        }

        return super.deviceType
    }

    #currentAdvertisementIsRewarded = false

    #isUserAccountAvailable = false

    #adCallbacks: CrazyGamesAdCallbacks = {
        adStarted: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        },
        adFinished: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
        },
        adError: () => {
            this._showAdFailurePopup(this.#currentAdvertisementIsRewarded)
        },
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('CrazyGames', 'SDK', 'init').then(() => {
                    this._platformSdk = window.CrazyGames!.SDK

                    this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                    this._isBannerSupported = true
                    this._isAdvancedBannersSupported = true;
                    (this._platformSdk as CrazyGamesSdk).init().then(() => {
                        this.#isUserAccountAvailable = (this._platformSdk as CrazyGamesSdk).user.isUserAccountAvailable
                        const getPlayerInfoPromise = this.#getPlayer()

                        if (this.options.xsollaProjectId) {
                            this.#ensurePaystationLoaded()
                        }

                        Promise
                            .all([getPlayerInfoPromise])
                            .finally(() => {
                                this._isInitialized = true
                                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            })
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer(): Promise<unknown> {
        if (!this.#isUserAccountAvailable) {
            return Promise.reject()
        }

        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER);
            (this._platformSdk as CrazyGamesSdk).user.showAuthPrompt()
                .then(() => {
                    this.#getPlayer()
                        .then(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                        })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown): Promise<unknown> {
        const sdk = this._platformSdk as CrazyGamesSdk
        switch (message) {
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED: {
                sdk.game.loadingStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED: {
                sdk.game.loadingStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED:
            case PLATFORM_MESSAGE.LEVEL_STARTED:
            case PLATFORM_MESSAGE.LEVEL_RESUMED: {
                sdk.game.gameplayStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED:
            case PLATFORM_MESSAGE.LEVEL_PAUSED:
            case PLATFORM_MESSAGE.LEVEL_COMPLETED:
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                sdk.game.gameplayStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT: {
                sdk.game.happytime()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // storage
    loadCloudKey(key: string): Promise<unknown> {
        const value = (this._platformSdk as CrazyGamesSdk).data.getItem(key)
        return Promise.resolve(value === undefined ? null : value)
    }

    saveCloudKey(key: string, value: unknown): Promise<void> {
        (this._platformSdk as CrazyGamesSdk).data.setItem(key, value as string)
        return Promise.resolve()
    }

    deleteCloudKey(key: string): Promise<void> {
        (this._platformSdk as CrazyGamesSdk).data.removeItem(key)
        return Promise.resolve()
    }

    // advertisement
    showBanner(position?: unknown): void {
        let container = document.getElementById(BANNER_CONTAINER_ID)
        if (!container) {
            container = createAdvertisementBannerContainer(position as 'top' | 'bottom')
        }

        container.style.display = 'block';
        (this._platformSdk as CrazyGamesSdk).banner.requestResponsiveBanner([BANNER_CONTAINER_ID])
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
                container!.style.display = 'none'
            })
    }

    hideBanner(): void {
        const container = document.getElementById(BANNER_CONTAINER_ID)
        if (container) {
            container.style.display = 'none'
        }

        (this._platformSdk as CrazyGamesSdk).banner.clearAllBanners()
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showAdvancedBanners(banners?: unknown): void {
        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        removeAdvancedBannerContainers()
        const containerIds = createAdvancedBannerContainers(banners as AdvancedBannerConfig[])

        const sdk = this._platformSdk as CrazyGamesSdk
        const requests = containerIds.map((id) => sdk.banner.requestResponsiveBanner(id))

        Promise.all(requests)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
                removeAdvancedBannerContainers()
            })
    }

    hideAdvancedBanners(): void {
        removeAdvancedBannerContainers();
        (this._platformSdk as CrazyGamesSdk).banner.clearAllBanners()
        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }

    showInterstitial(): void {
        this.#currentAdvertisementIsRewarded = false;
        (this._platformSdk as CrazyGamesSdk).ad.requestAd('midgame', this.#adCallbacks)
    }

    showRewarded(): void {
        this.#currentAdvertisementIsRewarded = true;
        (this._platformSdk as CrazyGamesSdk).ad.requestAd('rewarded', this.#adCallbacks)
    }

    checkAdBlock(): Promise<boolean> {
        return new Promise((resolve) => {
            (this._platformSdk as CrazyGamesSdk).ad.hasAdblock().then((res) => {
                resolve(res)
            })
        })
    }

    paymentsPurchase(id: string): Promise<unknown> {
        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        const sku = (product.platformProductId || product.id) as string

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#ensurePaystationLoaded()
                .then(() => this.#getXsollaToken())
                .then(async (userToken) => {
                    const orderResponse = await fetch(
                        `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/payment/item/${sku}`,
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${userToken}`,
                                'Content-Type': 'application/json',
                            },
                        },
                    )

                    if (!orderResponse.ok) {
                        throw new Error(`Xsolla create order HTTP ${orderResponse.status}`)
                    }

                    const orderData = await orderResponse.json()
                    const paymentToken = orderData.token
                    const orderId = orderData.order_id

                    const paystation = window.XPayStationWidget
                    if (!paystation) {
                        throw new Error('Xsolla Pay Station widget not loaded')
                    }

                    paystation.init({
                        access_token: paymentToken,
                        sandbox: this.options.isSandbox || false,
                        childWindow: { target: '_blank' },
                    })

                    let resolved = false
                    let handleVisibilityChange: () => void

                    const cleanup = () => {
                        document.removeEventListener('visibilitychange', handleVisibilityChange)
                    }

                    handleVisibilityChange = () => {
                        if (document.visibilityState === 'visible' && !resolved) {
                            setTimeout(() => {
                                if (!resolved) {
                                    resolved = true
                                    cleanup()
                                    this._rejectPromiseDecorator(
                                        ACTION_NAME.PURCHASE,
                                        new Error('Purchase canceled/closed'),
                                    )
                                }
                            }, 1500)
                        }
                    }

                    paystation.on(paystation.eventTypes.STATUS, (_evt, data) => {
                        try {
                            const info = ((data as AnyRecord) && ((data as AnyRecord).paymentInfo as AnyRecord)) || {}
                            if (info.status && /done|charged|success/i.test(String(info.status))) {
                                this.#getOrder(this.options.xsollaProjectId as string, orderId, userToken)
                                    .then((order) => {
                                        (this._platformSdk as CrazyGamesSdk).analytics.trackOrder('xsolla', order)

                                        const mergedPurchase: AnyRecord & { id: string } = {
                                            id: product.id as string,
                                            sku,
                                            orderId,
                                            ...order,
                                        }

                                        this._paymentsPurchases.push(mergedPurchase)

                                        if (!resolved) {
                                            resolved = true
                                            cleanup()
                                            this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                                        }
                                    })
                                    .catch((err) => {
                                        if (!resolved) {
                                            resolved = true
                                            cleanup()
                                            this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, err)
                                        }
                                    })
                            }
                        } catch (err) {
                            if (!resolved) {
                                resolved = true
                                cleanup()
                                this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, err)
                            }
                        }
                    })

                    paystation.on('close', () => {
                        if (!resolved) {
                            resolved = true
                            cleanup()
                            this._rejectPromiseDecorator(
                                ACTION_NAME.PURCHASE,
                                new Error('Purchase canceled/closed'),
                            )
                        }
                    })

                    paystation.open()
                    document.addEventListener('visibilitychange', handleVisibilityChange)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject(new Error('No platform products available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#getXsollaToken()
                .then((token) => fetch(
                    `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/items?limit=50`,
                    { headers: { Authorization: `Bearer ${token}` } },
                ))
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Xsolla catalog HTTP ${res.status}`)
                    }
                    return res.json()
                })
                .then((data) => {
                    const items = (data.items || []) as Array<AnyRecord & { sku: string }>
                    const bySku = new Map(items.map((it) => [it.sku, it]))

                    const mergedProducts = products.map((product) => {
                        const x = bySku.get(product.platformProductId as string)
                        const price = x?.price as { amount?: unknown; currency?: unknown } | undefined

                        return {
                            id: product.id,
                            name: x?.name ?? product.name ?? product.id,
                            description: x?.description ?? product.description ?? '',
                            price: price?.amount ?? null,
                            priceCurrencyCode: price?.currency ?? null,
                            priceValue: price?.amount ?? null,
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

    paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject(new Error('No such purchase to consume'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            const purchase = this._paymentsPurchases[purchaseIndex] as AnyRecord & { id: string; sku?: string }
            const sku = purchase.sku || purchase.id

            this.#getXsollaToken()
                .then((token) => fetch(
                    `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/user/inventory/item/consume`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sku,
                            quantity: 1,
                        }),
                    },
                ))
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Xsolla consume HTTP ${res.status}`)
                    }

                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
        }
        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#getXsollaToken()
                .then((token) => fetch(
                    `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/user/inventory/items`,
                    { headers: { Authorization: `Bearer ${token}` } },
                ))
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Xsolla inventory HTTP ${res.status}`)
                    }
                    return res.json()
                })
                .then((data) => {
                    const products = this._paymentsGetProductsPlatformData() || []

                    this._paymentsPurchases = ((data.items || []) as Array<AnyRecord & { sku: string }>)
                        .map((item) => {
                            const product = products.find((p) => p.id === item.sku)
                            if (!product) {
                                return null
                            }

                            const mergedPurchase: AnyRecord & { id: string } = {
                                id: product.id as string,
                                ...item,
                            }

                            return mergedPurchase
                        })
                        .filter((p): p is AnyRecord & { id: string } => p !== null)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    #getPlayer(): Promise<void> {
        if (!this.#isUserAccountAvailable) {
            this._playerApplyGuestData()
            return Promise.reject()
        }

        return new Promise<void>((resolve, reject) => {
            (this._platformSdk as CrazyGamesSdk).user.getUser()
                .then((user) => {
                    if (!user) {
                        this._playerApplyGuestData()
                        reject()
                        return
                    }

                    this._isPlayerAuthorized = true
                    if (user.username) {
                        this._playerName = user.username
                    }

                    if (user.profilePictureUrl) {
                        this._playerPhotos = [user.profilePictureUrl]
                    }

                    this._playerExtra = user as Record<string, unknown>

                    if (this._options.useUserToken) {
                        (this._platformSdk as CrazyGamesSdk).user.getUserToken()
                            .then((jwt) => {
                                this._playerExtra.jwt = jwt
                            })
                            .finally(() => {
                                resolve()
                            })
                    } else {
                        resolve()
                    }
                })
                .catch((error) => {
                    this._playerApplyGuestData()
                    reject(error)
                })
        })
    }

    async #ensurePaystationLoaded(): Promise<void> {
        if (window.XPayStationWidget) {
            return
        }
        await addJavaScript(XSOLLA_PAYSTATION_EMBED_URL)
    }

    async #getXsollaToken(): Promise<string> {
        const token = await (this._platformSdk as CrazyGamesSdk).user.getXsollaUserToken()
        return token
    }

    async #getOrder(projectId: string, orderId: string, token: string): Promise<AnyRecord> {
        const res = await fetch(
            `${XSOLLA_SDK_URL}/${projectId}/order/${orderId}`,
            { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) {
            throw new Error(`Xsolla order HTTP ${res.status}`)
        }
        return res.json()
    }
}

export default CrazyGamesPlatformBridge
