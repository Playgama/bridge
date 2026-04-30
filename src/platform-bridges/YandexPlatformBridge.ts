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
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    BANNER_STATE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type CloudStorageMode,
    type DeviceType,
    type LeaderboardType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = '/sdk.js'

interface YandexPlayer {
    getUniqueID(): string
    isAuthorized(): boolean
    getName(): string
    getPhoto(size: 'small' | 'medium' | 'large'): string | null
    getPayingStatus(): string
    getData(): Promise<AnyRecord>
    setData(data: AnyRecord): Promise<unknown>
    signature?: string
}

interface YandexPayments {
    purchase(product: AnyRecord): Promise<{ purchaseData: AnyRecord & { productID?: string } }>
    consumePurchase(token: string): Promise<unknown>
    getCatalog(): Promise<Array<AnyRecord & { id: string; getPriceCurrencyImage?: (size: string) => string }>>
    getPurchases(): Promise<Array<{ productID: string; purchaseData: AnyRecord & { productID?: string } }>>
}

interface YandexLeaderboardEntry {
    score: number
    rank: number
    player: {
        uniqueID: string
        publicName: string
        getAvatarSrc(size: 'small' | 'medium' | 'large'): string
    }
}

interface YandexLeaderboardOptions {
    quantityTop: number
    includeUser?: boolean
    quantityAround?: number
}

interface YandexSdk {
    environment: { i18n: { lang: string; tld: string } }
    deviceInfo: { type: string }
    features: {
        PluginEngineDataReporterAPI?: {
            report(data: { engineName: string; engineVersion: string; pluginName: string; pluginVersion: string }): Promise<unknown>
        }
        LoadingAPI?: { ready(): void }
        GameplayAPI?: { start(): void; stop(): void }
        GamesAPI: {
            getAllGames(): Promise<{ games: AnyRecord[] }>
            getGameByID(gameId: string | number): Promise<{ game: AnyRecord; isAvailable: boolean }>
        }
    }
    shortcut: {
        canShowPrompt(): Promise<{ canShow: boolean }>
        showPrompt(): Promise<{ outcome: string }>
    }
    getPayments(): Promise<YandexPayments>
    adv: {
        getBannerAdvStatus(): Promise<{ stickyAdvIsShowing?: boolean }>
        showBannerAdv(): Promise<{ stickyAdvIsShowing?: boolean }>
        hideBannerAdv(): Promise<{ stickyAdvIsShowing?: boolean }>
        showFullscreenAdv(options: { callbacks: AnyRecord }): void
        showRewardedVideo(options: { callbacks: AnyRecord }): void
    }
    on(event: string, callback: () => void): void
    serverTime(): number
    getPlayer(options: { signed: boolean }): Promise<YandexPlayer>
    auth: {
        openAuthDialog(): Promise<unknown>
    }
    feedback: {
        canReview(): Promise<{ value: boolean; reason?: unknown }>
        requestReview(): Promise<{ feedbackSent: boolean }>
    }
    leaderboards: {
        setScore(id: string, score: number): Promise<unknown>
        getEntries(id: string, options: YandexLeaderboardOptions): Promise<{ entries: YandexLeaderboardEntry[] }>
    }
    getFlags(options: AnyRecord): Promise<AnyRecord>
    clipboard: {
        writeText(text: string): Promise<unknown>
    }
}

declare global {
    interface Window {
        YaGames?: {
            init(): Promise<YandexSdk>
        }
    }
}

class YandexPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.YANDEX
    }

    get platformLanguage(): string {
        if (this._platformSdk) {
            return (this._platformSdk as YandexSdk).environment.i18n.lang.toLowerCase()
        }

        return super.platformLanguage
    }

    get platformTld(): string | null {
        if (this._platformSdk) {
            return (this._platformSdk as YandexSdk).environment.i18n.tld.toLowerCase()
        }

        return super.platformTld
    }

    get isPlatformGetAllGamesSupported(): boolean {
        return true
    }

    get isPlatformGetGameByIdSupported(): boolean {
        return true
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
        switch (this._platformSdk && (this._platformSdk as YandexSdk).deviceInfo.type) {
            case DEVICE_TYPE.DESKTOP: {
                return DEVICE_TYPE.DESKTOP
            }
            case DEVICE_TYPE.MOBILE: {
                return DEVICE_TYPE.MOBILE
            }
            case DEVICE_TYPE.TABLET: {
                return DEVICE_TYPE.TABLET
            }
            case DEVICE_TYPE.TV: {
                return DEVICE_TYPE.TV
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

    // social
    get isAddToHomeScreenSupported(): boolean {
        return this.#isAddToHomeScreenSupported
    }

    get isRateSupported(): boolean {
        return true
    }

    get isExternalLinksAllowed(): boolean {
        return false
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return this.#playerPromise!.then(() => undefined)
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    // config
    get isRemoteConfigSupported(): boolean {
        return true
    }

    #isAddToHomeScreenSupported = false

    #yandexPlayer: YandexPlayer | null = null

    #yandexPayments: YandexPayments | null = null

    #playerPromise: Promise<void> | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => {
                    waitFor('YaGames', 'init')
                        .then(() => {
                            window.YaGames!.init()
                                .then((sdk) => {
                                    this._platformSdk = sdk

                                    this.#playerPromise = this.#getPlayer()

                                    const reportPluginEnginePromise = (this._platformSdk as YandexSdk)
                                        .features
                                        .PluginEngineDataReporterAPI?.report({
                                            engineName: '',
                                            engineVersion: '',
                                            pluginName: PLUGIN_NAME,
                                            pluginVersion: PLUGIN_VERSION,
                                        })

                                    const checkAddToHomeScreenSupportedPromise = (this._platformSdk as YandexSdk)
                                        .shortcut
                                        .canShowPrompt()
                                        .then((prompt) => {
                                            this.#isAddToHomeScreenSupported = prompt.canShow
                                        })

                                    const checkAddToHomeScreenSupportedTimeoutPromise = new Promise<void>((resolve) => {
                                        setTimeout(resolve, 1000)
                                    })
                                    const checkAddToHomeScreenSupportedRacePromise = Promise.race([
                                        checkAddToHomeScreenSupportedPromise,
                                        checkAddToHomeScreenSupportedTimeoutPromise,
                                    ])

                                    const getPaymentsPromise = (this._platformSdk as YandexSdk).getPayments()
                                        .then((payments) => {
                                            this.#yandexPayments = payments
                                        })

                                    this._isBannerSupported = true
                                    const getBannerStatePromise = (this._platformSdk as YandexSdk).adv.getBannerAdvStatus()
                                        .then((data) => {
                                            if (data.stickyAdvIsShowing) {
                                                this._setBannerState(BANNER_STATE.SHOWN)
                                            }
                                        });
                                    (this._platformSdk as YandexSdk).on('game_api_pause', () => {
                                        this._setPauseState(true)
                                        this._setAudioState(false)
                                    });
                                    (this._platformSdk as YandexSdk).on('game_api_resume', () => {
                                        this._setPauseState(false)
                                        this._setAudioState(true)
                                    })

                                    Promise.all([
                                        reportPluginEnginePromise,
                                        checkAddToHomeScreenSupportedRacePromise,
                                        getPaymentsPromise,
                                        getBannerStatePromise,
                                    ])
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

    // platform
    sendMessage(message?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as YandexSdk).features.LoadingAPI?.ready()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED:
            case PLATFORM_MESSAGE.LEVEL_STARTED:
            case PLATFORM_MESSAGE.LEVEL_RESUMED: {
                (this._platformSdk as YandexSdk).features.GameplayAPI?.start()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED:
            case PLATFORM_MESSAGE.LEVEL_PAUSED:
            case PLATFORM_MESSAGE.LEVEL_COMPLETED:
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                (this._platformSdk as YandexSdk).features.GameplayAPI?.stop()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    getServerTime(): Promise<number> {
        return new Promise((resolve) => {
            const ts = (this._platformSdk as YandexSdk).serverTime()
            resolve(ts)
        })
    }

    getAllGames(): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as YandexSdk).features.GamesAPI.getAllGames()
                .then(({ games }) => {
                    resolve(games)
                })
                .catch(reject)
        })
    }

    getGameById(options?: { gameId?: string | number }): Promise<unknown> {
        if (!options?.gameId) {
            return Promise.reject(new Error('Provide gameId'))
        }

        return new Promise((resolve, reject) => {
            (this._platformSdk as YandexSdk).features.GamesAPI.getGameByID(options.gameId!)
                .then(({ game, isAvailable }) => {
                    resolve({ ...game, isAvailable })
                })
                .catch(reject)
        })
    }

    // player
    authorizePlayer(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this.#playerPromise = this.#getPlayer()

                this.#playerPromise.then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
            } else {
                (this._platformSdk as YandexSdk).auth.openAuthDialog()
                    .then(() => {
                        this.#playerPromise = this.#getPlayer()
                        this.#playerPromise.then(() => {
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

    // storage
    loadCloudSnapshot(): Promise<Record<string, unknown>> {
        return this.#playerPromise!.then(() => this.#yandexPlayer!.getData())
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>): Promise<void> {
        return this.#yandexPlayer!.setData(snapshot).then(() => undefined)
    }

    deleteCloudKeys(snapshot: Record<string, unknown>): Promise<void> {
        return this.#yandexPlayer!.setData(snapshot).then(() => undefined)
    }

    // advertisement
    showBanner(): void {
        (this._platformSdk as YandexSdk).adv.showBannerAdv()
            .then((data) => {
                if (data.stickyAdvIsShowing) {
                    this._setBannerState(BANNER_STATE.SHOWN)
                } else {
                    this._setBannerState(BANNER_STATE.FAILED)
                }
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        (this._platformSdk as YandexSdk).adv.hideBannerAdv()
            .then((data) => {
                if (!data.stickyAdvIsShowing) {
                    this._setBannerState(BANNER_STATE.HIDDEN)
                }
            })
    }

    showInterstitial(): void {
        (this._platformSdk as YandexSdk).adv.showFullscreenAdv({
            callbacks: {
                onOpen: () => {
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                },
                onClose: (wasShown: boolean) => {
                    if (wasShown) {
                        this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    } else {
                        this._showAdFailurePopup(false)
                    }
                },
                onError: (err: unknown) => {
                    console.error(err)
                },
            },
        })
    }

    showRewarded(): void {
        (this._platformSdk as YandexSdk).adv.showRewardedVideo({
            callbacks: {
                onOpen: () => {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                },
                onRewarded: () => {
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                },
                onClose: () => {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                },
                onError: () => {
                    this._showAdFailurePopup(true)
                },
            },
        })
    }

    checkAdBlock(): Promise<boolean> {
        return new Promise((resolve) => {
            // yandex shows ads even when adblock is on
            resolve(false)
        })
    }

    // social
    addToHomeScreen(): Promise<unknown> {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN);
            (this._platformSdk as YandexSdk).shortcut.showPrompt()
                .then((result) => {
                    if (result.outcome === 'accepted') {
                        this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                        return
                    }

                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN, error)
                })
        }

        return promiseDecorator.promise
    }

    rate(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE);
            (this._platformSdk as YandexSdk).feedback.canReview()
                .then((result) => {
                    if (result.value) {
                        (this._platformSdk as YandexSdk).feedback.requestReview()
                            .then(({ feedbackSent }) => {
                                if (feedbackSent) {
                                    this._resolvePromiseDecorator(ACTION_NAME.RATE)
                                    return
                                }

                                this._rejectPromiseDecorator(ACTION_NAME.RATE)
                            })
                            .catch((error) => {
                                this._rejectPromiseDecorator(ACTION_NAME.RATE, error)
                            })

                        return
                    }

                    this._rejectPromiseDecorator(ACTION_NAME.RATE, result.reason)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.RATE, error)
                })
        }

        return promiseDecorator.promise
    }

    // leaderboards
    leaderboardsSetScore(id: string, score: number): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE);
            (this._platformSdk as YandexSdk).leaderboards.setScore(id, score)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id: string): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            const options: YandexLeaderboardOptions = {
                quantityTop: 20,
            }

            if (this._isPlayerAuthorized) {
                options.includeUser = true
                options.quantityAround = 3
            }

            (this._platformSdk as YandexSdk).leaderboards.getEntries(id, options)
                .then((result) => {
                    let entries: AnyRecord[]

                    if (result && result.entries.length > 0) {
                        entries = result.entries.map((e) => ({
                            id: e.player.uniqueID,
                            name: e.player.publicName,
                            score: e.score,
                            rank: e.rank,
                            photo: e.player.getAvatarSrc('large'),
                        }))
                    } else {
                        entries = []
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, error)
                })
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        let product: AnyRecord | null = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#yandexPayments.purchase(product)
                .then((purchase) => {
                    const mergedPurchase: AnyRecord & { id: string } = { id, ...purchase.purchaseData }
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
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this.#yandexPayments.consumePurchase(this._paymentsPurchases[purchaseIndex].purchaseToken as string)
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
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        const products = this._paymentsGetProductsPlatformData()
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#yandexPayments.getCatalog()
                .then((yandexProducts) => {
                    const mergedProducts = products.map((product) => {
                        const yandexProduct = yandexProducts.find((p) => p.id === product.id)!

                        return {
                            id: product.id,
                            title: yandexProduct.title,
                            description: yandexProduct.description,
                            imageURI: yandexProduct.imageURI,
                            price: yandexProduct.price,
                            priceCurrencyCode: yandexProduct.priceCurrencyCode,
                            priceValue: yandexProduct.priceValue,
                            priceCurrencyImage: yandexProduct.getPriceCurrencyImage?.('medium'),
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
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#yandexPayments.getPurchases()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)!
                        const mergedPurchase: AnyRecord & { id: string } = {
                            id: product.id as string,
                            ...purchase.purchaseData,
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

    // config
    getRemoteConfig(options?: AnyRecord): Promise<unknown> {
        if (!this._platformSdk) {
            return Promise.reject()
        }

        let remoteConfigOptions: AnyRecord & { clientFeatures?: unknown[] } = options ?? {}
        if (!remoteConfigOptions) {
            remoteConfigOptions = {}
        }

        if (!remoteConfigOptions.clientFeatures) {
            remoteConfigOptions.clientFeatures = []
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG);
            (this._platformSdk as YandexSdk).getFlags(remoteConfigOptions)
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, error)
                })
        }
        return promiseDecorator.promise
    }

    // clipboard
    clipboardWrite(text: string): Promise<void> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE);
            (this._platformSdk as YandexSdk).clipboard.writeText(text)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, true)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, error)
                })
        }

        return promiseDecorator.promise.then(() => undefined)
    }

    #getPlayer(): Promise<void> {
        return new Promise<void>((resolve) => {
            let signed = false
            if (this._options && this._options.useSignedData) {
                signed = this._options.useSignedData as boolean
            }

            (this._platformSdk as YandexSdk).getPlayer({ signed })
                .then((player) => {
                    this._playerId = player.getUniqueID()
                    this._isPlayerAuthorized = player.isAuthorized()

                    this._setDefaultStorageType(
                        this._isPlayerAuthorized
                            ? STORAGE_TYPE.PLATFORM_INTERNAL
                            : STORAGE_TYPE.LOCAL_STORAGE,
                    )

                    const name = player.getName()
                    if (name !== '') {
                        this._playerName = name
                    }

                    this._playerPhotos = []
                    const photoSmall = player.getPhoto('small')
                    const photoMedium = player.getPhoto('medium')
                    const photoLarge = player.getPhoto('large')

                    if (photoSmall) {
                        this._playerPhotos.push(photoSmall)
                    }

                    if (photoMedium) {
                        this._playerPhotos.push(photoMedium)
                    }

                    if (photoLarge) {
                        this._playerPhotos.push(photoLarge)
                    }

                    this._playerExtra = {
                        payingStatus: player.getPayingStatus(),
                    }

                    if (signed) {
                        this._playerExtra.signature = player.signature
                    }

                    this.#yandexPlayer = player
                })
                .finally(() => {
                    resolve()
                })
        })
    }
}

export default YandexPlatformBridge
