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
import MessageBroker from '../common/MessageBroker'
import configFileModule from '../modules/ConfigFileModule'
import recorderModule from '../modules/RecorderModule'

import {
    PLATFORM_ID,
    MODULE_NAME,
    ACTION_NAME,
    EVENT_NAME,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    LEADERBOARD_TYPE,
    ERROR,
    type PlatformId,
    type StorageType,
    type CloudStorageMode,
    type DeviceType,
    type LeaderboardType,
} from '../constants'
import type { AnyRecord, SafeArea } from '../types/common'


const ADVERTISEMENT_TYPE = {
    INTERSTITIAL: 'interstitial',
    REWARD: 'reward',
    BANNER: 'banner',
    ADVANCED_BANNERS: 'advanced',
} as const

const MESSAGE_SOURCE = 'bridge'

const MODULE_NAME_QA = {
    LIVENESS: 'liveness',
} as const

export const INTERNAL_STORAGE_POLICY = {
    AUTHORIZED_ONLY: 'authorized_only',
    ALWAYS: 'always',
    NEVER: 'never',
} as const
export type InternalStoragePolicy = typeof INTERNAL_STORAGE_POLICY[keyof typeof INTERNAL_STORAGE_POLICY]

export const ACTION_NAME_QA = {
    IS_STORAGE_AVAILABLE: 'is_storage_available',
    IS_STORAGE_SUPPORTED: 'is_storage_supported',
    GET_DATA_FROM_STORAGE: 'get_data_from_storage',
    SET_DATA_TO_STORAGE: 'set_data_to_storage',
    DELETE_DATA_FROM_STORAGE: 'delete_data_from_storage',
    GET_SERVER_TIME: 'get_server_time',
    CHECK_ADBLOCK: 'check_adblock',
    CLIPBOARD_READ: 'clipboard_read',
    LIVENESS_PING: 'ping',
    UNLOCK_ACHIEVEMENT: 'unlock_achievement',
    GET_ACHIEVEMENTS: 'get_achievements',
    SHOW_ACHIEVEMENTS_NATIVE_POPUP: 'show_achievements_native_popup',
    GET_PERFORMANCE_RESOURCES: 'get_performance_resources',
    GET_LANGUAGE: 'get_language',
    GET_PLAYER: 'get_player',
    AUDIO_STATE: 'audio_state',
    PAUSE_STATE: 'pause_state',
    CLEAN_CACHE: 'clean_cache',
    SHOW_ADVANCED_BANNERS: 'show_advanced_banners',
    HIDE_ADVANCED_BANNERS: 'hide_advanced_banners',
} as const
export type ActionNameQa = typeof ACTION_NAME_QA[keyof typeof ACTION_NAME_QA]

const RECORDER_ACTION = {
    START_CAPTURE: 'start_capture',
    STOP_CAPTURE: 'stop_capture',
    RTC_OFFER: 'rtc_offer',
    RTC_ANSWER: 'rtc_answer',
    RTC_ICE: 'rtc_ice',
    CAPTURE_STARTED: 'capture_started',
    CAPTURE_ERROR: 'capture_error',
    TAKE_SCREENSHOT: 'take_screenshot',
    SCREENSHOT_RESULT: 'screenshot_result',
} as const

const INTERSTITIAL_STATUS = {
    START: 'start',
    OPEN: 'open',
    CLOSE: 'close',
    FAILED: 'failed',
} as const

const REWARD_STATUS = {
    START: 'start',
    OPEN: 'open',
    REWARDED: 'rewarded',
    CLOSE: 'close',
    FAILED: 'failed',
} as const

export const SUPPORTED_FEATURES = {
    PLAYER_AUTHORIZATION: 'isPlayerAuthorizationSupported',

    PAYMENTS: 'isPaymentsSupported',

    REMOTE_CONFIG: 'isRemoteConfigSupported',

    SOCIAL_SHARE: 'isShareSupported',
    SOCIAL_JOIN_COMMUNITY: 'isJoinCommunitySupported',
    SOCIAL_INVITE_FRIENDS: 'isInviteFriendsSupported',
    SOCIAL_CREATE_POST: 'isCreatePostSupported',
    SOCIAL_ADD_TO_FAVORITES: 'isAddToFavoritesSupported',
    SOCIAL_ADD_TO_HOME_SCREEN: 'isAddToHomeScreenSupported',
    SOCIAL_RATE: 'isRateSupported',

    STORAGE_LOCAL: 'isLocalStorageSupported',
    STORAGE_INTERNAL: 'isPlatformInternalStorageSupported',

    BANNER: 'isBannerSupported',
    INTERSTITIAL: 'isInterstitialSupported',
    REWARDED: 'isRewardedSupported',

    CLIPBOARD: 'isClipboardSupported',

    ADVANCED_BANNERS: 'isAdvancedBannersSupported',

    ACHIEVEMENTS: 'isAchievementsSupported',
    ACHIEVEMENTS_GET_LIST: 'isGetAchievementsListSupported',
    ACHIEVEMENTS_NATIVE_POPUP: 'isAchievementsNativePopupSupported',
} as const
export type SupportedFeature = typeof SUPPORTED_FEATURES[keyof typeof SUPPORTED_FEATURES]

interface QaToolMessage {
    type?: string
    action?: string
    id?: string
    source?: string
    options?: Record<string, unknown>
    payload?: Record<string, unknown>
    [key: string]: unknown
}

interface RequestPayload {
    options?: Record<string, unknown>
    [key: string]: unknown
}

interface RequestOptions {
    timeout?: number
}

class QaToolPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.QA_TOOL
    }

    get platformLanguage(): string {
        this.#sendMessage({
            type: MODULE_NAME.PLATFORM,
            action: ACTION_NAME_QA.GET_LANGUAGE,
            options: {
                language: this._platformLanguage,
            },
        })

        return this._platformLanguage ?? super.platformLanguage
    }

    get platformTld(): string | null {
        return this._platformTld
    }

    get deviceType(): DeviceType {
        return this._deviceType ?? super.deviceType
    }

    get platformPayload(): string | null {
        return this._platformPayload
    }

    get isPlayerAuthorizationSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PLAYER_AUTHORIZATION)
    }

    get isBannerSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.BANNER)
    }

    get isAdvancedBannersSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ADVANCED_BANNERS)
    }

    get isInterstitialSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.INTERSTITIAL)
    }

    get isRewardedSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.REWARDED)
    }

    get isAchievementsSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS)
    }

    get isGetAchievementsListSupported(): boolean {
        return (
            this.isAchievementsSupported
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS_GET_LIST)
        )
    }

    get isAchievementsNativePopupSupported(): boolean {
        return (
            this.isAchievementsSupported
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS_NATIVE_POPUP)
        )
    }

    get isInviteFriendsSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_INVITE_FRIENDS)
    }

    get isJoinCommunitySupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_JOIN_COMMUNITY)
    }

    get isShareSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_SHARE)
    }

    get isCreatePostSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_CREATE_POST)
    }

    get isAddToHomeScreenSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_ADD_TO_HOME_SCREEN)
    }

    get isAddToFavoritesSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_ADD_TO_FAVORITES)
    }

    get isRateSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_RATE)
    }

    get isPaymentsSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PAYMENTS)
    }

    get isRemoteConfigSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.REMOTE_CONFIG)
    }

    get isClipboardSupported(): boolean {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.CLIPBOARD)
    }

    get leaderboardsType(): LeaderboardType {
        return this._leaderboardsType ?? LEADERBOARD_TYPE.NOT_AVAILABLE
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        if (this.isStorageSupported(STORAGE_TYPE.PLATFORM_INTERNAL)) {
            return CLOUD_STORAGE_MODE.LAZY
        }
        return CLOUD_STORAGE_MODE.NONE
    }

    get cloudStorageReady(): Promise<void> {
        if (!this.isStorageAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)) {
            return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
        }
        return Promise.resolve()
    }

    get safeArea(): SafeArea | null {
        return null
    }

    protected _supportedFeatures: string[] = []

    protected _leaderboardsType: LeaderboardType | null = null

    protected _platformLanguage: string | undefined

    protected _platformTld: string | null = null

    protected _platformPayload: string | null = null

    protected _deviceType: DeviceType | null = null

    protected _internalStoragePolicy: InternalStoragePolicy = INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY

    engine: string = 'javascript'

    #messageBroker = new MessageBroker()

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: unknown) => {
                this.#sendMessage({
                    type: MODULE_NAME.PLATFORM,
                    action: ACTION_NAME_QA.AUDIO_STATE,
                    options: { isEnabled },
                })
            })
            this.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: unknown) => {
                this.#sendMessage({
                    type: MODULE_NAME.PLATFORM,
                    action: ACTION_NAME_QA.PAUSE_STATE,
                    options: { isPaused },
                })
            })

            const messageHandler = (event: MessageEvent) => {
                const data = event.data as QaToolMessage | undefined
                if (!data?.type || data?.source === MESSAGE_SOURCE) return

                if (data.type === MODULE_NAME.PLATFORM) {
                    if (data.action === ACTION_NAME.INITIALIZE) {
                        this.#getPlayer().then(() => {
                            this.#handleInitializeResponse(data)
                        })
                    } else if (data.action === ACTION_NAME_QA.AUDIO_STATE) {
                        this.#handleAudioState(data)
                    } else if (data.action === ACTION_NAME_QA.PAUSE_STATE) {
                        this.#handlePauseState(data)
                    } else if (data.action === ACTION_NAME_QA.GET_PERFORMANCE_RESOURCES) {
                        const messageId = this.#messageBroker.generateMessageId()
                        const requestedProps = (data?.options?.resources as string[] | undefined) || []
                        this.#getPerformanceResources(messageId, requestedProps)
                    } else if (data.action === ACTION_NAME_QA.CLEAN_CACHE) {
                        this.#cleanCache()
                    }
                } else if (data.type === MODULE_NAME.ADVERTISEMENT) {
                    this.#handleAdvertisement(data)
                } else if (data.type === MODULE_NAME.RECORDER) {
                    this.#handleRecorder(data)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#initRecorderCallbacks()

            this.#sendMessage({
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME.INITIALIZE,
                payload: {
                    engine: this.engine,
                    version: PLUGIN_VERSION,
                    configFile: {
                        loadingStatus: configFileModule.loadStatus,
                        parsingStatus: configFileModule.parseStatus,
                        loadError: configFileModule.loadError,
                        parseError: configFileModule.parseError,
                        options: configFileModule.options,
                        path: configFileModule.path,
                        rawContent: configFileModule.rawContent,
                    },
                },
            })
        }

        return promiseDecorator.promise
    }

    authorizePlayer(options?: unknown): Promise<unknown> {
        if (!this.isPlayerAuthorizationSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
            this.#requestMessage(MODULE_NAME.PLAYER, ACTION_NAME.AUTHORIZE_PLAYER, {
                options: options as Record<string, unknown> | undefined,
            }).then((data) => {
                const { auth } = (data as { auth: { status: string, error?: unknown } })
                if (auth.status === 'success') {
                    this.#getPlayer().then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    })
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, auth.error)
                }
            })
        }

        return promiseDecorator.promise
    }

    sendMessage(message?: unknown, options: unknown = {}): Promise<unknown> {
        const actions: string[] = [
            PLATFORM_MESSAGE.GAME_READY,
            PLATFORM_MESSAGE.LEVEL_STARTED,
            PLATFORM_MESSAGE.LEVEL_COMPLETED,
            PLATFORM_MESSAGE.LEVEL_FAILED,
            PLATFORM_MESSAGE.LEVEL_PAUSED,
            PLATFORM_MESSAGE.LEVEL_RESUMED,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
            PLATFORM_MESSAGE.GAMEPLAY_STARTED,
            PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
            PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT,
        ]

        if (typeof message === 'string' && actions.includes(message)) {
            this.#sendMessage({
                type: MODULE_NAME.PLATFORM,
                action: message,
                options: options as Record<string, unknown>,
            })

            return Promise.resolve()
        }

        return super.sendMessage(message, options)
    }

    getServerTime(): Promise<number> {
        return this.#requestMessage(MODULE_NAME.PLATFORM, ACTION_NAME_QA.GET_SERVER_TIME, {
            options: {},
        }, { timeout: 5_000 }).then((data) => {
            const { time } = (data as { time?: number })
            if (!time) {
                throw new Error('Invalid server time')
            }
            return time
        }).catch(() => {
            throw new Error('Server time request timeout')
        })
    }

    isStorageSupported(storageType: StorageType): boolean {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.IS_STORAGE_SUPPORTED,
            options: { storageType },
        })

        if (
            storageType === STORAGE_TYPE.PLATFORM_INTERNAL
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.STORAGE_INTERNAL)
        ) {
            return true
        }

        if (
            storageType === STORAGE_TYPE.LOCAL_STORAGE
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.STORAGE_LOCAL)
        ) {
            return true
        }

        return false
    }

    isStorageAvailable(storageType: StorageType): boolean {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.IS_STORAGE_AVAILABLE,
            options: { storageType },
        })

        if (
            storageType === STORAGE_TYPE.PLATFORM_INTERNAL
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.STORAGE_INTERNAL)
            && this.#isPlatformInternalStorageAvailable()
        ) {
            return this._localStorage !== null
        }

        if (
            storageType === STORAGE_TYPE.LOCAL_STORAGE
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.STORAGE_LOCAL)
        ) {
            return this._localStorage !== null
        }

        return false
    }

    loadCloudKey(key: string): Promise<unknown> {
        return this.#requestMessage(MODULE_NAME.STORAGE, ACTION_NAME_QA.GET_DATA_FROM_STORAGE, {
            options: { key, storageType: STORAGE_TYPE.PLATFORM_INTERNAL },
        }).then((data) => {
            const { storage } = (data as { storage: AnyRecord })
            const value = storage && storage[key]
            return value === undefined ? null : value
        })
    }

    saveCloudKey(key: string, value: unknown): Promise<void> {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.SET_DATA_TO_STORAGE,
            options: { key, value, storageType: STORAGE_TYPE.PLATFORM_INTERNAL },
        })
        return Promise.resolve()
    }

    deleteCloudKey(key: string): Promise<void> {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.DELETE_DATA_FROM_STORAGE,
            options: { key, storageType: STORAGE_TYPE.PLATFORM_INTERNAL },
        })
        return Promise.resolve()
    }

    showInterstitial(placement?: unknown): void {
        if (!this.isInterstitialSupported) {
            return
        }
        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.INTERSTITIAL,
            options: { placement },
        })
    }

    showRewarded(placement?: unknown): void {
        if (!this.isRewardedSupported) {
            return
        }
        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.REWARD,
            options: { placement },
        })
    }

    showBanner(position?: unknown, placement?: unknown): void {
        if (!this.isBannerSupported) {
            return
        }

        this._setBannerState(BANNER_STATE.SHOWN)

        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: BANNER_STATE.SHOWN,
            options: {
                type: ADVERTISEMENT_TYPE.BANNER,
                position,
                placement,
            },
        })
    }

    hideBanner(): void {
        if (!this.isBannerSupported) {
            return
        }

        this._setBannerState(BANNER_STATE.HIDDEN)

        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: BANNER_STATE.HIDDEN,
            options: { type: ADVERTISEMENT_TYPE.BANNER },
        })
    }

    showAdvancedBanners(banners?: unknown): void {
        if (!this.isAdvancedBannersSupported) {
            return
        }

        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ACTION_NAME_QA.SHOW_ADVANCED_BANNERS,
            options: {
                banners,
            },
        })
    }

    hideAdvancedBanners(): void {
        if (!this.isAdvancedBannersSupported) {
            return
        }

        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)

        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ACTION_NAME_QA.HIDE_ADVANCED_BANNERS,
        })
    }

    checkAdBlock(): Promise<boolean> {
        this.#sendMessage({
            type: ACTION_NAME_QA.CHECK_ADBLOCK,
            action: ACTION_NAME.ADBLOCK_DETECT,
        })

        return super.checkAdBlock()
    }

    inviteFriends(): Promise<unknown> {
        if (!this.isInviteFriendsSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.INVITE_FRIENDS,
            })
        }

        return promiseDecorator.promise
    }

    joinCommunity(): Promise<unknown> {
        if (!this.isJoinCommunitySupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.JOIN_COMMUNITY,
            })
        }

        return promiseDecorator.promise
    }

    share(): Promise<unknown> {
        if (!this.isShareSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this._resolvePromiseDecorator(ACTION_NAME.SHARE)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.SHARE,
            })
        }

        return promiseDecorator.promise
    }

    createPost(): Promise<unknown> {
        if (!this.isCreatePostSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.CREATE_POST,
            })
        }

        return promiseDecorator.promise
    }

    addToHomeScreen(): Promise<unknown> {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.ADD_TO_HOME_SCREEN,
            })
        }

        return promiseDecorator.promise
    }

    addToFavorites(): Promise<unknown> {
        if (!this.isAddToFavoritesSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)

            this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.ADD_TO_FAVORITES,
            })
        }

        return promiseDecorator.promise
    }

    rate(): Promise<unknown> {
        if (!this.isRateSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE)

            this._resolvePromiseDecorator(ACTION_NAME.RATE)

            this.#sendMessage({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.RATE,
            })
        }

        return promiseDecorator.promise
    }

    paymentsPurchase(id: string, options?: { externalId?: string }): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        const product = this._paymentsGetProductPlatformData(id)
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

            this.#requestMessage(MODULE_NAME.PAYMENTS, ACTION_NAME.PURCHASE, {
                options: { product },
            }).then((data) => {
                const { purchase } = (data as { purchase?: AnyRecord })
                if (!purchase || typeof purchase !== 'object') {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, new Error('Invalid purchase'))
                    return
                }
                if (purchase?.status) {
                    const mergedPurchase = { id, ...(purchase.purchaseData as AnyRecord) }
                    this._paymentsPurchases.push(mergedPurchase as AnyRecord & { id: string })
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                } else {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.PURCHASE,
                        purchase?.error || new Error('Unknown purchase error'),
                    )
                }
            })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id: string): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this.#requestMessage(MODULE_NAME.PAYMENTS, ACTION_NAME.CONSUME_PURCHASE, {
                options: { product: this._paymentsPurchases[purchaseIndex] },
            }).then((data) => {
                const { purchase } = (data as { purchase?: AnyRecord })
                if (!purchase || typeof purchase !== 'object') {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, new Error('Invalid purchase'))
                    return
                }
                if (purchase?.status) {
                    const result = {
                        id,
                        ...purchase,
                    }
                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, result)
                } else {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.CONSUME_PURCHASE,
                        purchase?.error || new Error('Unknown consume purchase error'),
                    )
                }
            })
        }
        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            const products = this._paymentsGetProductsPlatformData()

            this.#requestMessage(MODULE_NAME.PAYMENTS, ACTION_NAME.GET_CATALOG, {
                options: { products },
            }).then(() => {
                const mergedProducts = products.map((product) => ({
                    id: product.id,
                    price: `${product.amount} Gam`,
                    priceCurrencyCode: 'Gam',
                    priceCurrencyImage: 'https://games.playgama.com/assets/gold-fennec-coin-large.webp',
                    priceValue: product.amount,
                }))

                this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
            })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#requestMessage(MODULE_NAME.PAYMENTS, ACTION_NAME.GET_PURCHASES, {
                options: { products: this._paymentsGetProductsPlatformData() },
            }).then((data) => {
                const { purchases } = (data as { purchases: AnyRecord[] })
                const products = this._paymentsGetProductsPlatformData()

                this._paymentsPurchases = purchases.map((purchase) => {
                    const product = products.find((p) => p.id === purchase.id)
                    return {
                        id: product!.id as string,
                        ...(purchase.purchaseData as AnyRecord),
                    }
                })

                this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
            })
        }

        return promiseDecorator.promise
    }

    getRemoteConfig(): Promise<unknown> {
        if (!this.isRemoteConfigSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)

            this.#requestMessage(MODULE_NAME.REMOTE_CONFIG, ACTION_NAME.GET_REMOTE_CONFIG).then((data) => {
                const { result } = (data as { result?: unknown })
                this._resolvePromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, result)
            })
        }

        return promiseDecorator.promise
    }

    clipboardWrite(text: string): Promise<void> {
        if (!this.isClipboardSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

            this.#requestMessage(MODULE_NAME.CLIPBOARD, ACTION_NAME.CLIPBOARD_WRITE, {
                options: { text },
            }).then(() => {
                this._resolvePromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, true)
            })
        }

        return promiseDecorator.promise as Promise<void>
    }

    clipboardRead(): Promise<string> {
        if (!this.isClipboardSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)

            this.#requestMessage(MODULE_NAME.CLIPBOARD, ACTION_NAME_QA.CLIPBOARD_READ, {
                options: {},
            }).then((data) => {
                const { text } = (data as { text?: string })
                this._resolvePromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ, text)
            })
        }

        return promiseDecorator.promise as Promise<string>
    }

    leaderboardsSetScore(id?: unknown, score?: unknown, _isMain?: unknown): Promise<unknown> {
        if (this.leaderboardsType === LEADERBOARD_TYPE.NOT_AVAILABLE) {
            return Promise.reject(new Error('Leaderboards are not available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const options = {
                id,
                score,
            }

            this.#sendMessage({
                type: MODULE_NAME.LEADERBOARDS,
                action: ACTION_NAME.LEADERBOARDS_SET_SCORE,
                options,
            })

            this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id?: unknown): Promise<unknown> {
        if (this.leaderboardsType !== LEADERBOARD_TYPE.IN_GAME) {
            return Promise.reject(new Error('Leaderboards are not available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            this.#requestMessage(MODULE_NAME.LEADERBOARDS, ACTION_NAME.LEADERBOARDS_GET_ENTRIES, {
                options: { id },
            }, { timeout: 5_000 }).then((data) => {
                const { entries } = (data as { entries?: unknown })
                this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
            }).catch(() => {
                this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
            })
        }

        return promiseDecorator.promise
    }

    leaderboardsShowNativePopup(id?: unknown): Promise<unknown> {
        if (this.leaderboardsType !== LEADERBOARD_TYPE.NATIVE_POPUP) {
            return Promise.reject(new Error('Leaderboards are not available'))
        }

        this.#sendMessage({
            type: MODULE_NAME.LEADERBOARDS,
            action: ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP,
            options: { id },
        })

        return Promise.resolve(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)
    }

    unlockAchievement(options?: unknown): Promise<unknown> {
        if (!this.isAchievementsSupported) {
            return Promise.reject()
        }

        return this.#requestMessage(MODULE_NAME.ACHIEVEMENTS, ACTION_NAME_QA.UNLOCK_ACHIEVEMENT, {
            options: options as Record<string, unknown> | undefined,
        }).then((data) => (data as { result?: unknown }).result)
    }

    getAchievementsList(options?: unknown): Promise<unknown> {
        if (!this.isGetAchievementsListSupported) {
            return Promise.reject()
        }
        return this.#requestMessage(MODULE_NAME.ACHIEVEMENTS, ACTION_NAME_QA.GET_ACHIEVEMENTS, {
            options: options as Record<string, unknown> | undefined,
        }).then((data) => (data as { result?: unknown }).result)
    }

    showAchievementsNativePopup(): Promise<unknown> {
        if (!this.isAchievementsNativePopupSupported) {
            return Promise.reject()
        }

        this.#sendMessage({
            type: MODULE_NAME.ACHIEVEMENTS,
            action: ACTION_NAME_QA.SHOW_ACHIEVEMENTS_NATIVE_POPUP,
        })

        return Promise.resolve()
    }

    protected _paymentsGetProductsPlatformData(): AnyRecord[] {
        if (!this._options.payments) {
            return []
        }

        return this._options.payments
            .map((product) => ({
                id: product.id,
                ...(product.playgama as AnyRecord | undefined),
            }))
    }

    protected _paymentsGetProductPlatformData(id: string): AnyRecord | null {
        const products = this._options.payments
        if (!products) {
            return null
        }

        const product = products.find((p) => p.id === id)
        if (!product) {
            return null
        }

        return {
            id: product.id,
            ...(product.playgama as AnyRecord | undefined),
        }
    }

    #handleInitializeResponse(data: QaToolMessage): void {
        this._supportedFeatures = (data.supportedFeatures as string[]) || []
        this._isBannerSupported = this._supportedFeatures.includes(SUPPORTED_FEATURES.BANNER)
        this._isAdvancedBannersSupported = this._supportedFeatures.includes(SUPPORTED_FEATURES.ADVANCED_BANNERS)

        const config = (data.config as AnyRecord | undefined) ?? {}
        this._deviceType = (config.deviceType as DeviceType | undefined) ?? super.deviceType
        this._platformLanguage = config.platformLanguage
            ? (config.platformLanguage as string).toLowerCase()
            : super.platformLanguage
        this._platformTld = (config.platformTld as string | null | undefined) ?? super.platformTld
        this._platformPayload = (config.platformPayload as string | null | undefined) ?? super.platformPayload
        this._leaderboardsType = (config.leaderboardsType as LeaderboardType | undefined) ?? LEADERBOARD_TYPE.NOT_AVAILABLE
        this._internalStoragePolicy = (config.internalStoragePolicy as InternalStoragePolicy | undefined)
            ?? INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY

        this._paymentsPurchases = (data.purchases as Array<AnyRecord & { id: string }>) || []

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)

        this.#updateDefaultStorageType()

        this.#sendMessage({
            type: MODULE_NAME_QA.LIVENESS,
            action: ACTION_NAME_QA.LIVENESS_PING,
            options: { version: PLUGIN_VERSION },
        })
    }

    #handleAudioState(data: QaToolMessage): void {
        this._setAudioState((data.options as { isEnabled: boolean }).isEnabled)
    }

    #handlePauseState(data: QaToolMessage): void {
        this._setPauseState((data.options as { isPaused: boolean }).isPaused)
    }

    #getPerformanceResources(messageId: string, requestedProps: string[] = []): Promise<PerformanceEntry[]> {
        const props = Array.isArray(requestedProps) ? requestedProps : []
        const resources = performance.getEntriesByType('resource') || []
        const defaultProps = ['name', 'initiatorType']
        const propsToExtract = props.length > 0 ? props : defaultProps

        const serializableResources = resources.map((resource) => {
            const extracted: Record<string, unknown> = {}
            propsToExtract.forEach((prop) => {
                if (prop in resource) {
                    extracted[prop] = (resource as unknown as Record<string, unknown>)[prop]
                }
            })
            return extracted
        })

        this.#sendMessage({
            type: MODULE_NAME.PLATFORM,
            action: ACTION_NAME_QA.GET_PERFORMANCE_RESOURCES,
            id: messageId,
            options: { resources: serializableResources },
        })

        return Promise.resolve(resources)
    }

    #sendMessage(message: QaToolMessage): void {
        this.#messageBroker.send({
            source: MESSAGE_SOURCE,
            ...message,
        })
    }

    #requestMessage(
        type: string,
        action: string,
        payload: RequestPayload = {},
        options: RequestOptions = {},
    ): Promise<unknown> {
        const messageId = this.#messageBroker.generateMessageId()

        const mergedOptions: RequestOptions = {
            timeout: 0,
            ...options,
        }

        return new Promise((resolve, reject) => {
            const messageHandler = (event: MessageEvent) => {
                const data = event.data as QaToolMessage | undefined
                if (
                    data?.type === type
                    && data?.action === action
                    && data?.id === messageId
                    && data?.source !== MESSAGE_SOURCE
                ) {
                    this.#messageBroker.removeListener(messageHandler)
                    resolve(data)
                }
            }
            this.#messageBroker.addListener(messageHandler)
            this.#sendMessage({
                type,
                action,
                id: messageId,
                options: options as unknown as Record<string, unknown>,
                ...payload,
            })

            if ((mergedOptions.timeout ?? 0) > 0) {
                setTimeout(() => {
                    reject(new Error('Request timeout'))
                    this.#messageBroker.removeListener(messageHandler)
                }, mergedOptions.timeout)
            }
        })
    }

    async #getPlayer(): Promise<void> {
        return this.#requestMessage(MODULE_NAME.PLAYER, ACTION_NAME_QA.GET_PLAYER).then((data) => {
            const { player } = (data as { player?: AnyRecord })
            if (player?.isAuthorized) {
                this._playerId = (player.userId as string) ?? null
                this._isPlayerAuthorized = !!player.isAuthorized
                this._playerName = (player.name as string) ?? null
                if (Array.isArray(player.photos)) {
                    this._playerPhotos = [...(player.photos as string[])]
                }
                this._playerExtra = player
                this.#updateDefaultStorageType()
            } else {
                this._playerApplyGuestData()
            }
        }).catch(() => {
            this._playerApplyGuestData()
        })
    }

    #handleAdvertisement(data: QaToolMessage): void {
        const { action, payload } = data
        const status = (payload as { status?: string } | undefined)?.status

        if (action === ADVERTISEMENT_TYPE.INTERSTITIAL) {
            if (!this.isInterstitialSupported) {
                return
            }
            switch (status) {
                case INTERSTITIAL_STATUS.START:
                    this._setInterstitialState(INTERSTITIAL_STATE.LOADING)
                    break
                case INTERSTITIAL_STATUS.OPEN:
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case INTERSTITIAL_STATUS.FAILED:
                    this._showAdFailurePopup(false)
                    break
                case INTERSTITIAL_STATUS.CLOSE:
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    break
                default:
                    break
            }
        } else if (action === ADVERTISEMENT_TYPE.REWARD) {
            if (!this.isRewardedSupported) {
                return
            }
            switch (status) {
                case REWARD_STATUS.START:
                    this._setRewardedState(REWARDED_STATE.LOADING)
                    break
                case REWARD_STATUS.OPEN: {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    break
                }
                case REWARD_STATUS.REWARDED: {
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    break
                }
                case REWARD_STATUS.CLOSE: {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    break
                }
                case REWARD_STATUS.FAILED: {
                    this._showAdFailurePopup(true)
                    break
                }
                default: {
                    break
                }
            }
        } else if (action === ADVERTISEMENT_TYPE.ADVANCED_BANNERS) {
            switch (status) {
                case BANNER_STATE.SHOWN:
                    this._setAdvancedBannersState(BANNER_STATE.SHOWN)
                    break
                case BANNER_STATE.HIDDEN:
                    this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
                    break
                case BANNER_STATE.FAILED:
                    this._setAdvancedBannersState(BANNER_STATE.FAILED)
                    break
                case BANNER_STATE.LOADING:
                    this._setAdvancedBannersState(BANNER_STATE.LOADING)
                    break
                default:
                    break
            }
        }
    }

    #handleRecorder(data: QaToolMessage): void {
        switch (data.action) {
            case RECORDER_ACTION.START_CAPTURE:
                recorderModule.startCapture((data.options as Record<string, unknown> | undefined) || {})
                break
            case RECORDER_ACTION.STOP_CAPTURE:
                recorderModule.stopCapture()
                break
            case RECORDER_ACTION.RTC_ANSWER:
                recorderModule.handleAnswer(data.options as { sdp: string })
                break
            case RECORDER_ACTION.RTC_ICE:
                recorderModule.handleIce(data.options as RTCIceCandidateInit)
                break
            case RECORDER_ACTION.TAKE_SCREENSHOT: {
                const result = recorderModule.takeScreenshot((data.options as Record<string, unknown> | undefined) || {})
                this.#sendMessage({
                    type: MODULE_NAME.RECORDER,
                    action: RECORDER_ACTION.SCREENSHOT_RESULT,
                    payload: result as unknown as Record<string, unknown>,
                })
                break
            }
            default:
                break
        }
    }

    #initRecorderCallbacks(): void {
        recorderModule.onOffer = (sdp) => {
            this.#sendMessage({
                type: MODULE_NAME.RECORDER,
                action: RECORDER_ACTION.RTC_OFFER,
                payload: { sdp },
            })
        }
        recorderModule.onIceCandidate = (candidate) => {
            this.#sendMessage({
                type: MODULE_NAME.RECORDER,
                action: RECORDER_ACTION.RTC_ICE,
                payload: candidate as unknown as Record<string, unknown>,
            })
        }
        recorderModule.onStarted = () => {
            this.#sendMessage({
                type: MODULE_NAME.RECORDER,
                action: RECORDER_ACTION.CAPTURE_STARTED,
            })
        }
        recorderModule.onError = (message) => {
            this.#sendMessage({
                type: MODULE_NAME.RECORDER,
                action: RECORDER_ACTION.CAPTURE_ERROR,
                payload: { message },
            })
        }
    }

    #isPlatformInternalStorageAvailable(): boolean {
        return (this._internalStoragePolicy === INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY && this._isPlayerAuthorized)
            || this._internalStoragePolicy === INTERNAL_STORAGE_POLICY.ALWAYS
    }

    #updateDefaultStorageType(): void {
        this._setDefaultStorageType(
            this.#isPlatformInternalStorageAvailable()
                ? STORAGE_TYPE.PLATFORM_INTERNAL
                : STORAGE_TYPE.LOCAL_STORAGE,
        )
    }

    #cleanCache(): void {
        if (this.engine === 'unity') {
            indexedDB.deleteDatabase('UnityCache')
        }
    }
}

export default QaToolPlatformBridge
