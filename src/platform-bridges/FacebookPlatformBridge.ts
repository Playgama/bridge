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
    createLoadingOverlay,
    isBase64Image,
    waitFor,
} from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type DeviceType,
    type LeaderboardType,
    type StorageType,
    type CloudStorageMode,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.8.0.js'

const LEADERBOARD_XML = `
    <View style="position: fixed; top: 0px; left: 0px; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center" onTapEvent="close">
        <View style="position: relative; background-color: #2E3C75;color: #fff;padding: 20px;border-radius: 10px;box-shadow: 0 0 10px #2E3C75;font-size: 24px;text-align: center;min-width: 250px;max-width: 30%;max-height: 80%;overflow: auto;flex-direction: column;justify-content: center;align-items: center;">
            <View style="display: flex; flex-direction: column; align-items: center; justify-content: center;" onTapEvent="leaderboard">
                <For source="{{players}}" itemName="player">
                    <View style="display: flex;align-items: center;justify-content: space-between;width: 100%;gap: 10px;">
                      <Image src="{{FBInstant.players[{{player.sessionID}}].photo}}" style="width: 50px; height: 50px; border-radius: 50%" />
                      <Text content="{{FBInstant.players[{{player.sessionID}}].name}}" style="flex: 1; text-align: start;" />
                      <Text content="{{player.score}}" />
                    </View>
                </For>
            </View>
        </View>
    </View>
`

interface FacebookAd {
    loadAsync(): Promise<unknown>
    showAsync(): Promise<unknown>
}

interface FacebookOverlayView {
    showAsync(): Promise<unknown>
    dismissAsync(): Promise<unknown>
    iframeElement: HTMLIFrameElement
}

interface FacebookOverlayHandle {
    iframeElement: HTMLIFrameElement
}

interface FacebookLeaderboardEntry {
    getScore(): number
    getPlayer(): { getSessionID(): string }
}

interface FacebookCatalogProduct {
    productID: string
    title: string
    description: string
    imageURI: string
    price: string
    priceCurrencyCode: string
    priceAmount: number
}

interface FacebookPurchase {
    productID: string
    purchaseToken: string
    [key: string]: unknown
}

interface FacebookSdk {
    initializeAsync(): Promise<unknown>
    setLoadingProgress(value: number): void
    startGameAsync(): Promise<unknown>
    getLocale(): string
    getSupportedAPIs(): string[]
    getPlatform(): string
    player: {
        getID(): string
        getDataAsync(keys: string[]): Promise<Record<string, unknown>>
        setDataAsync(data: Record<string, unknown>): Promise<unknown>
        isSubscribedBotAsync(): Promise<boolean>
        canSubscribeBotAsync(): Promise<boolean>
        subscribeBotAsync(): Promise<unknown>
    }
    context: {
        getID(): string
    }
    community: {
        canFollowOfficialPageAsync(): Promise<boolean>
        canJoinOfficialGroupAsync(): Promise<boolean>
        followOfficialPageAsync(): Promise<unknown>
        joinOfficialGroupAsync(): Promise<unknown>
    }
    loadBannerAdAsync(placement: unknown, position: unknown): Promise<unknown>
    hideBannerAdAsync(): Promise<unknown>
    getInterstitialAdAsync(placement: unknown): Promise<FacebookAd>
    getRewardedVideoAsync(placement: unknown): Promise<FacebookAd>
    globalLeaderboards: {
        setScoreAsync(id: unknown, score: number): Promise<unknown>
        getTopEntriesAsync(id: unknown, count: number): Promise<FacebookLeaderboardEntry[]>
    }
    overlayViews: {
        setCustomEventHandler(handler: (event: string) => void): void
        createOverlayViewWithXMLString(
            xml: string,
            id: string,
            data: AnyRecord,
            onSuccess: (overlayView: FacebookOverlayView) => void,
            onError: (overlayView: unknown, error: unknown) => void,
        ): FacebookOverlayHandle
    }
    payments: {
        purchaseAsync(options: { productID: string }): Promise<FacebookPurchase>
        consumePurchaseAsync(token: string): Promise<unknown>
        getCatalogAsync(): Promise<FacebookCatalogProduct[]>
        getPurchasesAsync(): Promise<FacebookPurchase[]>
    }
    inviteAsync(options: AnyRecord): Promise<unknown>
    shareAsync(options: AnyRecord): Promise<unknown>
}

declare global {
    interface Window {
        FBInstant?: FacebookSdk
    }
}

class FacebookPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.FACEBOOK
    }

    get platformLanguage(): string {
        return this._platformLanguage || super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // device
    get deviceType(): DeviceType {
        switch (this._platformSdk && (this._platformSdk as FacebookSdk).getPlatform()) {
            case 'IOS':
            case 'ANDROID':
            case 'MOBILE_WEB': {
                return DEVICE_TYPE.MOBILE
            }
            case 'WEB': {
                return DEVICE_TYPE.DESKTOP
            }
            default: {
                return super.deviceType
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // advertisement
    get isBannerSupported(): boolean {
        return true
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE_POPUP
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    // social
    get isInviteFriendsSupported(): boolean {
        return this._supportedApis.includes('inviteAsync')
    }

    get isJoinCommunitySupported(): boolean {
        return this._isJoinCommunitySupported
    }

    get isShareSupported(): boolean {
        return this._supportedApis.includes('shareAsync')
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.LAZY
    }

    get cloudStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    protected _platformLanguage: string | null = null

    protected _contextId: string | null = null

    protected _supportedApis: string[] = []

    protected _preloadedInterstitialPromises: Record<string, Promise<FacebookAd> | null> = {}

    protected _preloadedRewardedPromises: Record<string, Promise<FacebookAd> | null> = {}

    protected _defaultStorageType: StorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    protected _isJoinCommunitySupported = false

    protected _overlay: FacebookOverlayView | null = null

    #leaderboardClicked = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('FBInstant'))
                .then(() => {
                    this._platformSdk = window.FBInstant as FacebookSdk
                    return (this._platformSdk as FacebookSdk).initializeAsync()
                })
                .then(() => {
                    const sdk = this._platformSdk as FacebookSdk
                    this._isPlayerAuthorized = true
                    this._playerId = sdk.player.getID()
                    this._contextId = sdk.context.getID()

                    let language: string | null = sdk.getLocale()
                    if (typeof language === 'string') {
                        language = language.substring(0, 2).toLowerCase()
                    }
                    this._platformLanguage = language

                    this._supportedApis = sdk.getSupportedAPIs()

                    this.#setupLeaderboards()

                    return Promise.allSettled([
                        sdk.community.canFollowOfficialPageAsync(),
                        sdk.community.canJoinOfficialGroupAsync(),
                    ]).then(([pageFollow, groupJoin]) => {
                        const canFollow = pageFollow.status === 'fulfilled' ? pageFollow.value : false
                        const canJoin = groupJoin.status === 'fulfilled' ? groupJoin.value : false
                        this._isJoinCommunitySupported = (canFollow === true && canJoin === true)
                    })
                })
                .then(() => {
                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((e) => this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e))
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                const sdk = this._platformSdk as FacebookSdk
                sdk.setLoadingProgress(100)

                if (this._options.subscribeForNotificationsOnStart) {
                    setTimeout(() => this.#subscribeBotAsync(), 0)
                }

                return new Promise((resolve) => {
                    sdk.startGameAsync().then(resolve)
                })
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // player
    authorizePlayer(_options?: unknown): Promise<unknown> {
        return Promise.resolve()
    }

    // storage
    loadCloudKey(key: string): Promise<unknown> {
        return (this._platformSdk as FacebookSdk).player.getDataAsync([key]).then((data) => {
            const value = data[key]
            if (value === undefined || value === null) {
                return null
            }
            return typeof value === 'string' ? value : JSON.stringify(value)
        })
    }

    saveCloudKey(key: string, value: unknown): Promise<void> {
        return (this._platformSdk as FacebookSdk).player.setDataAsync({ [key]: value }).then(() => undefined)
    }

    deleteCloudKey(key: string): Promise<void> {
        return (this._platformSdk as FacebookSdk).player.setDataAsync({ [key]: null }).then(() => undefined)
    }

    // advertisement
    showBanner(position?: unknown, placement?: unknown): void {
        (this._platformSdk as FacebookSdk).loadBannerAdAsync(placement, position)
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        (this._platformSdk as FacebookSdk).hideBannerAdAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    preloadInterstitial(placement?: unknown): void {
        this.#preloadInterstitial(placement as string)
    }

    showInterstitial(placement?: unknown): void {
        this.#preloadInterstitial(placement as string)
            .then((preloadedInterstitial) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return preloadedInterstitial.showAsync()
            })
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                this.#preloadInterstitial(placement as string, true)
            })
            .catch(() => this._advertisementShowErrorPopup(false))
    }

    preloadRewarded(placement?: unknown): void {
        this.#preloadRewarded(placement as string)
    }

    showRewarded(placement?: unknown): void {
        this.#preloadRewarded(placement as string)
            .then((preloadedRewarded) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return preloadedRewarded.showAsync()
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
                this.#preloadRewarded(placement as string, true)
            })
            .catch(() => this._advertisementShowErrorPopup(true))
    }

    // leaderboards
    leaderboardsSetScore(id?: unknown, score?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const numericScore = typeof score === 'number' ? score : parseInt(score as string, 10);
            (this._platformSdk as FacebookSdk).globalLeaderboards.setScoreAsync(id, numericScore)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsShowNativePopup(id?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)

            const loadingOverlay = createLoadingOverlay()
            document.body.appendChild(loadingOverlay)

            const sdk = this._platformSdk as FacebookSdk
            sdk.globalLeaderboards.getTopEntriesAsync(id, 20).then((entries) => {
                const players = entries.map((entry) => ({
                    score: entry.getScore(),
                    sessionID: entry.getPlayer().getSessionID(),
                }))

                const overlay = sdk.overlayViews.createOverlayViewWithXMLString(
                    LEADERBOARD_XML,
                    '',
                    { players },
                    (overlayView) => {
                        overlayView.showAsync()
                        this._overlay = overlayView
                        loadingOverlay.remove()

                        this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)
                    },
                    (_, error) => {
                        loadingOverlay.remove()
                        this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP, error)
                    },
                )

                const { iframeElement } = overlay

                iframeElement.style.zIndex = '9999'
                iframeElement.style.position = 'absolute'
                iframeElement.style.top = '0'
                iframeElement.style.left = '0'
                iframeElement.style.height = '100vh'
                iframeElement.style.width = '100vw'
                iframeElement.style.border = '0'
                iframeElement.id = iframeElement.name

                document.body.appendChild(iframeElement)
            })
                .catch((error) => {
                    loadingOverlay.remove()
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP, error)
                })
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const productId = (product.platformProductId
                ? product.platformProductId
                : product.id) as string;
            (this._platformSdk as FacebookSdk).payments.purchaseAsync({ productID: productId.toLowerCase() })
                .then((purchase) => {
                    const mergedPurchase: AnyRecord & { id: string } = { id, ...purchase }
                    delete mergedPurchase.productID
                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
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

            const purchaseToken = this._paymentsPurchases[purchaseIndex].purchaseToken as string;
            (this._platformSdk as FacebookSdk).payments.consumePurchaseAsync(purchaseToken)
                .then(() => {
                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
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
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG);
            (this._platformSdk as FacebookSdk).payments.getCatalogAsync()
                .then((facebookProducts) => {
                    const mergedProducts = products.map((product) => {
                        const facebookProduct = facebookProducts.find(
                            (p) => p.productID === product.platformProductId,
                        ) as FacebookCatalogProduct

                        return {
                            id: product.id,
                            title: facebookProduct.title,
                            description: facebookProduct.description,
                            imageURI: facebookProduct.imageURI,
                            price: facebookProduct.price,
                            priceCurrencyCode: facebookProduct.priceCurrencyCode,
                            priceValue: facebookProduct.priceAmount,
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

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES);
            (this._platformSdk as FacebookSdk).payments.getPurchasesAsync()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID) as AnyRecord
                        const mergedPurchase: AnyRecord & { id: string } = {
                            id: product.id as string,
                            ...purchase,
                        }

                        delete mergedPurchase.productID
                        return mergedPurchase
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    // social
    inviteFriends(options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as { image?: string; text?: string }
        if (!opts.image || !opts.text) {
            return Promise.reject()
        }

        if (!isBase64Image(opts.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS);
            (this._platformSdk as FacebookSdk).inviteAsync(opts as AnyRecord)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, error)
                })
        }

        return promiseDecorator.promise
    }

    joinCommunity(options?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            const opts = options as { isPage?: boolean } | undefined
            const sdk = this._platformSdk as FacebookSdk
            if (opts && opts.isPage === true) {
                sdk.community.followOfficialPageAsync()
                    .then((res) => this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, res))
                    .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, err))
            } else {
                sdk.community.joinOfficialGroupAsync()
                    .then((res) => this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, res))
                    .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, err))
            }
        }

        return promiseDecorator.promise
    }

    share(options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as AnyRecord & { image?: string; text?: string }
        if (!opts.image || !opts.text) {
            return Promise.reject()
        }

        if (!isBase64Image(opts.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE);
            (this._platformSdk as FacebookSdk).shareAsync({
                intent: 'REQUEST',
                ...opts,
            })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }

    #setupLeaderboards(): void {
        const self = this;
        (self._platformSdk as FacebookSdk).overlayViews.setCustomEventHandler((event) => {
            if (event === 'leaderboard') {
                self.#leaderboardClicked = true
            } else if (event === 'close') {
                if (self.#leaderboardClicked) {
                    self.#leaderboardClicked = false
                    return
                }

                if (self._overlay) {
                    const iframeId = self._overlay.iframeElement.id
                    const iframeNode = document.getElementById(iframeId)
                    if (iframeNode) {
                        document.body.removeChild(iframeNode)
                    }

                    self._overlay.dismissAsync()
                    self._overlay = null
                }
            }
        })
    }

    #preloadInterstitial(placementId: string, forciblyPreload = false): Promise<FacebookAd> {
        if (!forciblyPreload && this._preloadedInterstitialPromises[placementId]) {
            return this._preloadedInterstitialPromises[placementId] as Promise<FacebookAd>
        }

        let preloadedInterstitial: FacebookAd | null = null

        const promise = (this._platformSdk as FacebookSdk).getInterstitialAdAsync(placementId)
            .then((interstitial) => {
                preloadedInterstitial = interstitial
                return interstitial.loadAsync()
            })
            .then(() => preloadedInterstitial as FacebookAd)
            .catch(() => {
                this._preloadedInterstitialPromises[placementId] = null
                return Promise.reject()
            })

        this._preloadedInterstitialPromises[placementId] = promise
        return promise
    }

    #preloadRewarded(placementId: string, forciblyPreload = false): Promise<FacebookAd> {
        if (!forciblyPreload && this._preloadedRewardedPromises[placementId]) {
            return this._preloadedRewardedPromises[placementId] as Promise<FacebookAd>
        }

        let preloadedRewarded: FacebookAd | null = null

        const promise = (this._platformSdk as FacebookSdk).getRewardedVideoAsync(placementId)
            .then((rewarded) => {
                preloadedRewarded = rewarded
                return rewarded.loadAsync()
            })
            .then(() => preloadedRewarded as FacebookAd)
            .catch(() => {
                this._preloadedRewardedPromises[placementId] = null
                return Promise.reject()
            })

        this._preloadedRewardedPromises[placementId] = promise
        return promise
    }

    async #subscribeBotAsync(): Promise<unknown> {
        const sdk = this._platformSdk as FacebookSdk
        try {
            const isSubscribed = await sdk.player.isSubscribedBotAsync()
            if (isSubscribed) {
                return Promise.resolve()
            }
        } catch (e) {
            if ((e as { code?: string })?.code === 'INVALID_OPERATION') {
                // web-messenger platform
            } else {
                throw new Error(e as string)
            }
        }

        let canSubscribe = false

        try {
            canSubscribe = await sdk.player.canSubscribeBotAsync()
            if (canSubscribe) {
                return sdk.player.subscribeBotAsync()
            }
        } catch (e) {
            if ((e as { code?: string })?.code === 'INVALID_OPERATION') {
                return Promise.resolve()
            }

            throw new Error(e as string)
        }

        return Promise.resolve()
    }
}

export default FacebookPlatformBridge
