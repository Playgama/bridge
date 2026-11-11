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
    toBase64Image,
    waitFor,
    type AnyRecord,
} from '../utils'
import { ACTION_NAME } from '../constants'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    type PlatformId,
} from '../modules/platform/constants'
import { DEVICE_TYPE, type DeviceType } from '../modules/device/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../modules/advertisement/constants'
import { LEADERBOARD_TYPE, type LeaderboardType } from '../modules/leaderboards/constants'

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.8.0.js'

// Player data key that counts game launches, so prompts can skip the first one.
const SESSION_COUNTER_KEY = 'playgama_bridge_session'

// Player data key with the one-time prompts the player has already seen.
const SHOWN_PROMPTS_KEY = 'playgama_bridge_shown_prompts'

const AUTO_PROMPT = {
    JOIN_COMMUNITY: 'joinCommunity',
    SHARE: 'share',
} as const

type AutoPrompt = typeof AUTO_PROMPT[keyof typeof AUTO_PROMPT]

// Prompts the bridge shows by itself once per session, see FacebookAutoPromptsConfig.
const AUTO_PROMPTS_DEFAULTS: Required<FacebookAutoPromptsConfig> = {
    fromSession: 2,
    addToHomeScreen: true,
    joinCommunity: true,
    share: true,
}

// `autoPrompts` option of the facebook platform config: one platform prompt per
// session, starting from `fromSession`: share once (its content comes from
// `social.share`), then join the community once, then the offer to save the game
// every session until it is saved. `false` turns them off.
export interface FacebookAutoPromptsConfig {
    fromSession?: number
    addToHomeScreen?: boolean
    joinCommunity?: boolean
    share?: boolean
}

interface FacebookSessionInfo {
    number: number
    shownPrompts: AutoPrompt[]
}

interface FacebookAd {
    loadAsync(): Promise<unknown>
    showAsync(): Promise<unknown>
}

// share/invite payload: `image` or a v8 `imageOverlayPath` overlay, other keys go to the SDK as is.
type SharePayload = AnyRecord & { image?: string; text?: string; imageOverlayPath?: string }

interface FacebookTournament {
    getID(): string
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
    onPause(callback: () => void): void
    // Present in the SDK but not documented, so it is checked before use.
    onResume?: (callback: () => void) => void
    canCreateShortcutAsync(): Promise<boolean>
    createShortcutAsync(): Promise<unknown>
    getTournamentAsync(): Promise<FacebookTournament>
    tournament: {
        postScoreAsync(score: number): Promise<unknown>
    }
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

    get isPlatformExternalCallsSupported(): boolean {
        return false
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

    // leaderboards — SDK 8.0 has no leaderboard API anymore (globalLeaderboards
    // was removed), so scores go to the tournament the game was launched in.
    get leaderboardsType(): LeaderboardType {
        return this.#tournament ? LEADERBOARD_TYPE.NATIVE : LEADERBOARD_TYPE.NOT_AVAILABLE
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
        return this.#canFollowPage || this.#canJoinGroup
    }

    get isShareSupported(): boolean {
        return this._supportedApis.includes('shareAsync')
    }

    get isAddToHomeScreenSupported(): boolean {
        return this._supportedApis.includes('createShortcutAsync')
    }

    protected _platformLanguage: string | null = null

    protected _contextId: string | null = null

    protected _supportedApis: string[] = []

    protected _preloadedInterstitialPromises: Record<string, Promise<FacebookAd> | null> = {}

    protected _preloadedRewardedPromises: Record<string, Promise<FacebookAd> | null> = {}

    protected _isPlatformStorageAvailable = true

    #canFollowPage = false

    #canJoinGroup = false

    #tournament: FacebookTournament | null = null

    #isGameStarted = false

    // Resolves with the current launch, number 0 when it is unknown.
    #sessionPromise: Promise<FacebookSessionInfo> = Promise.resolve({ number: 0, shownPrompts: [] })

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

                    this.#setupPauseEvents()

                    if (this.#getAutoPromptsConfig()) {
                        this.#sessionPromise = this.#trackSession()
                    }

                    return Promise.allSettled([
                        sdk.community.canFollowOfficialPageAsync(),
                        sdk.community.canJoinOfficialGroupAsync(),
                        // Wrapped so a synchronous throw on old clients does not break initialization.
                        Promise.resolve().then(() => sdk.getTournamentAsync()),
                    ]).then(([pageFollow, groupJoin, tournament]) => {
                        this.#canFollowPage = pageFollow.status === 'fulfilled' && pageFollow.value === true
                        this.#canJoinGroup = groupJoin.status === 'fulfilled' && groupJoin.value === true
                        this.#tournament = tournament.status === 'fulfilled' ? tournament.value : null
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

                return new Promise((resolve) => {
                    sdk.startGameAsync().then((result) => {
                        this.#isGameStarted = true
                        // Platform prompts work only once the game is started.
                        this.#showStartPrompt()
                        resolve(result)
                    })
                })
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // Facebook accepts the loading progress only before the game is started.
    // 100 is sent on game ready: the bridge reports 100 as a fallback right after
    // its own initialization, while the game may still be loading.
    setLoadingProgress(percent: number): void {
        const sdk = this._platformSdk as FacebookSdk | null
        if (!sdk || !this._isInitialized || this.#isGameStarted || percent >= 100) {
            return
        }

        sdk.setLoadingProgress(Math.max(0, percent))
    }

    // player
    authorizePlayer(_options?: unknown): Promise<unknown> {
        return Promise.resolve()
    }

    // storage — Facebook reads and writes batches of keys at once.
    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        const data = await (this._platformSdk as FacebookSdk).player.getDataAsync(keys)
        const result: Record<string, unknown> = {}
        keys.forEach((key) => {
            const rawValue = data[key]
            if (rawValue === undefined || rawValue === null || rawValue === '') {
                return
            }
            result[key] = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue)
        })
        return result
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        return (this._platformSdk as FacebookSdk).player.setDataAsync(data).then(() => undefined)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        const data: Record<string, unknown> = {}
        keys.forEach((key) => { data[key] = null })
        return (this._platformSdk as FacebookSdk).player.setDataAsync(data).then(() => undefined)
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
    leaderboardsSetScore(_id?: unknown, score?: unknown, isMain?: boolean): Promise<unknown> {
        if (!this.#tournament) {
            return Promise.reject()
        }

        // A tournament has one score, so with several leaderboards only the main one goes there.
        const hasMain = this._options.leaderboards?.some((leaderboard) => leaderboard.isMain === true)
        if (hasMain && !isMain) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const numericScore = typeof score === 'number' ? score : parseInt(score as string, 10);
            (this._platformSdk as FacebookSdk).tournament.postScoreAsync(numericScore)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
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
        const opts = (options ?? {}) as SharePayload
        if (!this.#isSharePayloadValid(opts)) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
            this.#withBase64Image(opts)
                .then((payload) => (this._platformSdk as FacebookSdk).inviteAsync(payload))
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
            const { community } = this._platformSdk as FacebookSdk
            // Without an explicit choice the group is kept as before, the page when there is no group.
            const isPage = opts?.isPage ?? !this.#canJoinGroup
            const request = isPage ? community.followOfficialPageAsync() : community.joinOfficialGroupAsync()
            request
                .then((res) => this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, res))
                .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, err))
        }

        return promiseDecorator.promise
    }

    addToHomeScreen(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            const sdk = this._platformSdk as FacebookSdk
            sdk.canCreateShortcutAsync()
                .then((canCreate) => (canCreate ? sdk.createShortcutAsync() : Promise.reject()))
                .then(() => this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN))
                .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN, err))
        }

        return promiseDecorator.promise
    }

    share(options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as SharePayload
        if (!this.#isSharePayloadValid(opts)) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)
            this.#withBase64Image({ intent: 'REQUEST', ...opts })
                .then((payload) => (this._platformSdk as FacebookSdk).shareAsync(payload))
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }

    #isSharePayloadValid(payload: SharePayload): boolean {
        return !!payload.text && (!!payload.image || !!payload.imageOverlayPath)
    }

    // Facebook requires a base64 image; a config-supplied URL is fetched and encoded.
    #withBase64Image(payload: SharePayload): Promise<SharePayload> {
        if (!payload.image) {
            return Promise.resolve(payload)
        }

        return toBase64Image(payload.image).then((image) => ({ ...payload, image }))
    }

    #setupPauseEvents(): void {
        const sdk = this._platformSdk as FacebookSdk
        sdk.onPause(() => {
            this._setPauseState(true)
            this._setAudioState(false)
        })

        const resume = () => {
            this._setPauseState(false)
            this._setAudioState(true)
        }

        // onResume is not documented, so returning to the page resumes the game as well.
        if (typeof sdk.onResume === 'function') {
            sdk.onResume(resume)
        }

        window.addEventListener('focus', resume)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                resume()
            }
        })
    }

    #getAutoPromptsConfig(): Required<FacebookAutoPromptsConfig> | null {
        const { autoPrompts } = this._options
        if (autoPrompts === false) {
            return null
        }

        return { ...AUTO_PROMPTS_DEFAULTS, ...autoPrompts }
    }

    #trackSession(): Promise<FacebookSessionInfo> {
        const { player } = this._platformSdk as FacebookSdk
        return player.getDataAsync([SESSION_COUNTER_KEY, SHOWN_PROMPTS_KEY])
            .then((data) => {
                const number = (Number(data[SESSION_COUNTER_KEY]) || 0) + 1
                player.setDataAsync({ [SESSION_COUNTER_KEY]: number }).catch(() => {})
                const shownPrompts = Array.isArray(data[SHOWN_PROMPTS_KEY])
                    ? data[SHOWN_PROMPTS_KEY] as AutoPrompt[]
                    : []
                return { number, shownPrompts }
            })
            .catch(() => ({ number: 0, shownPrompts: [] }))
    }

    // Shows at most one platform prompt per session: the one-time share and community
    // prompts first, otherwise the offer to save the game.
    async #showStartPrompt(): Promise<void> {
        if (this._options.subscribeForNotificationsOnStart && await this.#subscribeBotAsync()) {
            return
        }

        const config = this.#getAutoPromptsConfig()
        if (!config) {
            return
        }

        const session = await this.#sessionPromise
        if (session.number < config.fromSession) {
            return
        }

        const isNew = (prompt: AutoPrompt) => !session.shownPrompts.includes(prompt)
        const prompts: Array<() => Promise<boolean>> = []
        if (config.share && isNew(AUTO_PROMPT.SHARE)) {
            prompts.push(() => this.#showOnce(session, AUTO_PROMPT.SHARE, () => this.#promptShare()))
        }

        if (config.joinCommunity && isNew(AUTO_PROMPT.JOIN_COMMUNITY)) {
            prompts.push(() => this.#showOnce(session, AUTO_PROMPT.JOIN_COMMUNITY, () => this.#promptJoinCommunity()))
        }

        // The save offer repeats until the game is saved, then the SDK stops allowing it.
        if (config.addToHomeScreen) {
            prompts.push(() => this.#promptAddToHomeScreen())
        }

        await prompts.reduce(
            (isShown, prompt) => isShown.then((shown) => shown || prompt()),
            Promise.resolve(false),
        )
    }

    // Remembers a shown one-time prompt in player data, so it is not shown again.
    async #showOnce(
        session: FacebookSessionInfo,
        prompt: AutoPrompt,
        show: () => Promise<boolean>,
    ): Promise<boolean> {
        const shown = await show()
        if (shown) {
            session.shownPrompts.push(prompt)
            const { player } = this._platformSdk as FacebookSdk
            player.setDataAsync({ [SHOWN_PROMPTS_KEY]: session.shownPrompts }).catch(() => {})
        }

        return shown
    }

    // Shares the `social.share` config content, skipped when it has no text or image.
    #promptShare(): Promise<boolean> {
        const payload = { ...this._options.social?.share } as SharePayload
        if (!this.isShareSupported || !this.#isSharePayloadValid(payload)) {
            return Promise.resolve(false)
        }

        return this.#withBase64Image({ intent: 'REQUEST', ...payload })
            .then(
                (data) => (this._platformSdk as FacebookSdk).shareAsync(data).then(() => true, () => true),
                () => false,
            )
    }

    // Resolves true when the prompt was shown, whatever the player chose.
    #promptAddToHomeScreen(): Promise<boolean> {
        const sdk = this._platformSdk as FacebookSdk
        return sdk.canCreateShortcutAsync()
            .then((canCreate) => (canCreate ? sdk.createShortcutAsync().then(() => true, () => true) : false))
            .catch(() => false)
    }

    // The page goes first: following it is what Facebook counts as using the community APIs.
    #promptJoinCommunity(): Promise<boolean> {
        const { community } = this._platformSdk as FacebookSdk
        let request: Promise<unknown>
        if (this.#canFollowPage) {
            request = community.followOfficialPageAsync()
        } else if (this.#canJoinGroup) {
            request = community.joinOfficialGroupAsync()
        } else {
            return Promise.resolve(false)
        }

        return request.then(() => true, () => true)
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

    // Resolves true when the subscription prompt was shown, whatever the player chose.
    async #subscribeBotAsync(): Promise<boolean> {
        const { player } = this._platformSdk as FacebookSdk
        try {
            if (await player.isSubscribedBotAsync()) {
                return false
            }
        } catch {
            // Messenger on web rejects with INVALID_OPERATION, canSubscribeBotAsync decides there.
        }

        try {
            if (!await player.canSubscribeBotAsync()) {
                return false
            }
        } catch {
            return false
        }

        await player.subscribeBotAsync().catch(() => {})
        return true
    }

    #ensureStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }
}

export default FacebookPlatformBridge
