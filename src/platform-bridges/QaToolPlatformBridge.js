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
    LEADERBOARD_TYPE,
    ERROR,
} from '../constants'
import { getKeysFromObject } from '../common/utils'

const ADVERTISEMENT_TYPE = {
    INTERSTITIAL: 'interstitial',
    REWARD: 'reward',
    BANNER: 'banner',
}

const MESSAGE_SOURCE = 'bridge'

const MODULE_NAME_QA = {
    LIVENESS: 'liveness',
}

export const INTERNAL_STORAGE_POLICY = {
    AUTHORIZED_ONLY: 'authorized_only',
    ALWAYS: 'always',
    NEVER: 'never',
}

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
}

const INTERSTITIAL_STATUS = {
    START: 'start',
    OPEN: 'open',
    CLOSE: 'close',
    FAILED: 'failed',
}

const REWARD_STATUS = {
    START: 'start',
    OPEN: 'open',
    REWARDED: 'rewarded',
    CLOSE: 'close',
    FAILED: 'failed',
}

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

    ACHIEVEMENTS: 'isAchievementsSupported',
    ACHIEVEMENTS_GET_LIST: 'isGetAchievementsListSupported',
    ACHIEVEMENTS_NATIVE_POPUP: 'isAchievementsNativePopupSupported',
}

class QaToolPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.QA_TOOL
    }

    get platformLanguage() {
        this.#sendMessage({
            type: MODULE_NAME.PLATFORM,
            action: ACTION_NAME_QA.GET_LANGUAGE,
            options: {
                language: this._platformLanguage,
            },
        })

        return this._platformLanguage
    }

    get platformTld() {
        return this._platformTld
    }

    get deviceType() {
        return this._deviceType
    }

    get platformPayload() {
        return this._platformPayload
    }

    // player
    get isPlayerAuthorizationSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PLAYER_AUTHORIZATION)
    }

    // advertisement
    get isBannerSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.BANNER)
    }

    get isInterstitialSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.INTERSTITIAL)
    }

    get isRewardedSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.REWARDED)
    }

    // achievements
    get isAchievementsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS)
    }

    get isGetAchievementsListSupported() {
        return (
            this.isAchievementsSupported
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS_GET_LIST)
        )
    }

    get isAchievementsNativePopupSupported() {
        return (
            this.isAchievementsSupported
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS_NATIVE_POPUP)
        )
    }

    // Social
    get isInviteFriendsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_INVITE_FRIENDS)
    }

    get isJoinCommunitySupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_JOIN_COMMUNITY)
    }

    get isShareSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_SHARE)
    }

    get isCreatePostSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_CREATE_POST)
    }

    get isAddToHomeScreenSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_ADD_TO_HOME_SCREEN)
    }

    get isAddToFavoritesSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_ADD_TO_FAVORITES)
    }

    get isRateSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SOCIAL_RATE)
    }

    // payments
    get isPaymentsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PAYMENTS)
    }

    // config
    get isRemoteConfigSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.REMOTE_CONFIG)
    }

    // clipboard
    get isClipboardSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.CLIPBOARD)
    }

    // leaderboards
    get leaderboardsType() {
        return this._leaderboardsType ?? LEADERBOARD_TYPE.NOT_AVAILABLE
    }

    _supportedFeatures = []

    _leaderboardsType = null

    #messageBroker = new MessageBroker()

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled) => {
                this.#sendMessage({
                    type: MODULE_NAME.PLATFORM,
                    action: ACTION_NAME_QA.AUDIO_STATE,
                    options: { isEnabled },
                })
            })
            this.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused) => {
                this.#sendMessage({
                    type: MODULE_NAME.PLATFORM,
                    action: ACTION_NAME_QA.PAUSE_STATE,
                    options: { isPaused },
                })
            })

            const messageHandler = ({ data }) => {
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
                        const requestedProps = data?.options?.resources || []
                        this.#getPerformanceResources(messageId, requestedProps)
                    } else if (data.action === ACTION_NAME_QA.CLEAN_CACHE) {
                        this.#cleanCache()
                    }
                } else if (data.type === MODULE_NAME.ADVERTISEMENT) {
                    this.#handleAdvertisement(data)
                }
            }

            this.#messageBroker.addListener(messageHandler)
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

    // player
    authorizePlayer(options) {
        if (!this.isPlayerAuthorizationSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
            this.#requestMessage(MODULE_NAME.PLAYER, ACTION_NAME.AUTHORIZE_PLAYER, {
                options,
            }).then(({ auth }) => {
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

    sendMessage(message, options = {}) {
        const actions = [
            PLATFORM_MESSAGE.GAME_READY,
            PLATFORM_MESSAGE.LEVEL_COMPLETE,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
            PLATFORM_MESSAGE.GAMEPLAY_STARTED,
            PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
            PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT,
            PLATFORM_MESSAGE.GAME_OVER,
        ]

        if (actions.includes(message)) {
            this.#sendMessage({
                type: MODULE_NAME.PLATFORM,
                action: message,
                options,
            })

            return Promise.resolve()
        }

        return super.sendMessage(message, options)
    }

    getServerTime() {
        return this.#requestMessage(MODULE_NAME.PLATFORM, ACTION_NAME_QA.GET_SERVER_TIME, {
            options: {},
        }, { timeout: 5_000 }).then(({ time }) => {
            if (!time) {
                throw new Error('Invalid server time')
            }
            return time
        }).catch(() => {
            throw new Error('Server time request timeout')
        })
    }

    // storage
    isStorageSupported(storageType) {
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

    isStorageAvailable(storageType) {
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
            return super.isStorageAvailable(STORAGE_TYPE.LOCAL_STORAGE)
        }

        if (
            storageType === STORAGE_TYPE.LOCAL_STORAGE
            && this._supportedFeatures.includes(SUPPORTED_FEATURES.STORAGE_LOCAL)
        ) {
            return super.isStorageAvailable(STORAGE_TYPE.LOCAL_STORAGE)
        }

        return false
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (!this.isStorageSupported(storageType)) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        return this.#requestMessage(MODULE_NAME.STORAGE, ACTION_NAME_QA.GET_DATA_FROM_STORAGE, {
            options: { key, storageType, tryParseJson },
        }).then(({ storage }) => getKeysFromObject(key, storage, tryParseJson))
    }

    setDataToStorage(key, value, storageType) {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.SET_DATA_TO_STORAGE,
            options: { key, value, storageType },
        })

        if (!this.isStorageSupported(storageType)) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (
            storageType === STORAGE_TYPE.PLATFORM_INTERNAL
            || (storageType === STORAGE_TYPE.LOCAL_STORAGE)
        ) {
            return Promise.resolve()
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        this.#sendMessage({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.DELETE_DATA_FROM_STORAGE,
            options: { key, storageType },
        })

        if (!this.isStorageSupported(storageType)) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (
            storageType === STORAGE_TYPE.PLATFORM_INTERNAL
            || (storageType === STORAGE_TYPE.LOCAL_STORAGE)
        ) {
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial(placement) {
        if (!this.isInterstitialSupported) {
            return
        }
        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.INTERSTITIAL,
            options: { placement },
        })
    }

    showRewarded(placement) {
        if (!this.isRewardedSupported) {
            return
        }
        this.#sendMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.REWARD,
            options: { placement },
        })
    }

    showBanner(position, placement) {
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

    hideBanner() {
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

    checkAdBlock() {
        this.#sendMessage({
            type: ACTION_NAME_QA.CHECK_ADBLOCK,
            action: ACTION_NAME.ADBLOCK_DETECT,
        })

        return super.checkAdBlock()
    }

    // Social
    inviteFriends() {
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

    joinCommunity() {
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

    share() {
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

    createPost() {
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

    addToHomeScreen() {
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

    addToFavorites() {
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

    rate() {
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

    // payments
    paymentsPurchase(id, options) {
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
            }).then(({ purchase }) => {
                if (!purchase || typeof purchase !== 'object') {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, new Error('Invalid purchase'))
                    return
                }
                if (purchase?.status) {
                    const mergedPurchase = { id, ...purchase.purchaseData }
                    this._paymentsPurchases.push(mergedPurchase)
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

    paymentsConsumePurchase(id) {
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
            }).then(({ purchase }) => {
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

    paymentsGetCatalog() {
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

    paymentsGetPurchases() {
        if (!this.isPaymentsSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#requestMessage(MODULE_NAME.PAYMENTS, ACTION_NAME.GET_PURCHASES, {
                options: { products: this._paymentsGetProductsPlatformData() },
            }).then(({ purchases }) => {
                const products = this._paymentsGetProductsPlatformData()

                this._paymentsPurchases = purchases.map((purchase) => {
                    const product = products.find((p) => p.id === purchase.id)
                    return {
                        id: product.id,
                        ...purchase.purchaseData,
                    }
                })

                this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
            })
        }

        return promiseDecorator.promise
    }

    // config
    getRemoteConfig() {
        if (!this.isRemoteConfigSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)

            this.#requestMessage(MODULE_NAME.REMOTE_CONFIG, ACTION_NAME.GET_REMOTE_CONFIG).then(({ result }) => {
                this._resolvePromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, result)
            })
        }

        return promiseDecorator.promise
    }

    // clipboard
    clipboardWrite(text) {
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

        return promiseDecorator.promise
    }

    clipboardRead() {
        if (!this.isClipboardSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)

            this.#requestMessage(MODULE_NAME.CLIPBOARD, ACTION_NAME_QA.CLIPBOARD_READ, {
                options: {},
            }).then(({ text }) => {
                this._resolvePromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ, text)
            })
        }

        return promiseDecorator.promise
    }

    // leaderboards
    leaderboardsSetScore(id, score) {
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

    leaderboardsGetEntries(id) {
        if (this.leaderboardsType !== LEADERBOARD_TYPE.IN_GAME) {
            return Promise.reject(new Error('Leaderboards are not available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            this.#requestMessage(MODULE_NAME.LEADERBOARDS, ACTION_NAME.LEADERBOARDS_GET_ENTRIES, {
                options: { id },
            }, { timeout: 5_000 }).then(({ entries }) => {
                this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
            }).catch(() => {
                this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
            })
        }

        return promiseDecorator.promise
    }

    leaderboardsShowNativePopup(id) {
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

    // achievements
    unlockAchievement(options) {
        if (!this.isAchievementsSupported) {
            return Promise.reject()
        }

        return this.#requestMessage(MODULE_NAME.ACHIEVEMENTS, ACTION_NAME_QA.UNLOCK_ACHIEVEMENT, {
            options,
        }).then(({ result }) => result)
    }

    getAchievementsList(options) {
        if (!this.isGetAchievementsListSupported) {
            return Promise.reject()
        }
        return this.#requestMessage(MODULE_NAME.ACHIEVEMENTS, ACTION_NAME_QA.GET_ACHIEVEMENTS, {
            options,
        }).then(({ result }) => result)
    }

    showAchievementsNativePopup() {
        if (!this.isAchievementsNativePopupSupported) {
            return Promise.reject()
        }

        this.#sendMessage({
            type: MODULE_NAME.ACHIEVEMENTS,
            action: ACTION_NAME_QA.SHOW_ACHIEVEMENTS_NATIVE_POPUP,
        })

        return Promise.resolve()
    }

    _paymentsGetProductsPlatformData() {
        if (!this._options.payments) {
            return []
        }

        return this._options.payments
            .map((product) => ({
                id: product.id,
                ...product.playgama,
            }))
    }

    _paymentsGetProductPlatformData(id) {
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
            ...product.playgama,
        }
    }

    #handleInitializeResponse(data) {
        this._supportedFeatures = data.supportedFeatures || []
        this._isBannerSupported = this._supportedFeatures.includes(SUPPORTED_FEATURES.BANNER)

        const { config = {} } = data
        this._deviceType = config.deviceType ?? super.deviceType
        this._platformLanguage = config.platformLanguage
            ? config.platformLanguage.toLowerCase()
            : super.platformLanguage
        this._platformTld = config.platformTld ?? super.platformTld
        this._platformPayload = config.platformPayload ?? super.platformPayload
        this._leaderboardsType = config.leaderboardsType ?? LEADERBOARD_TYPE.NOT_AVAILABLE
        this._internalStoragePolicy = config.internalStoragePolicy ?? INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY

        this._paymentsPurchases = data.purchases || []

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)

        this.#updateDefaultStorageType()

        this.#sendMessage({
            type: MODULE_NAME_QA.LIVENESS,
            action: ACTION_NAME_QA.LIVENESS_PING,
            options: { version: PLUGIN_VERSION },
        })
    }

    #handleAudioState(data) {
        this._setAudioState(data.options.isEnabled)
    }

    #handlePauseState(data) {
        this._setPauseState(data.options.isPaused)
    }

    #getPerformanceResources(messageId, requestedProps = []) {
        const props = Array.isArray(requestedProps) ? requestedProps : []
        const resources = performance.getEntriesByType('resource') || []
        const defaultProps = ['name', 'initiatorType']
        const propsToExtract = props.length > 0 ? props : defaultProps

        const serializableResources = resources.map((resource) => {
            const extracted = {}
            propsToExtract.forEach((prop) => {
                if (prop in resource) {
                    extracted[prop] = resource[prop]
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

    #sendMessage(message) {
        this.#messageBroker.send({
            source: MESSAGE_SOURCE,
            ...message,
        })
    }

    #requestMessage(type, action, payload = {}, options = {}) {
        const messageId = this.#messageBroker.generateMessageId()

        const mergedOptions = {
            timeout: 0,
            ...options,
        }

        return new Promise((resolve, reject) => {
            const messageHandler = ({ data }) => {
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
                options,
                ...payload,
            })

            if (mergedOptions.timeout > 0) {
                setTimeout(() => {
                    reject(new Error('Request timeout'))
                    this.#messageBroker.removeListener(messageHandler)
                }, mergedOptions.timeout)
            }
        })
    }

    async #getPlayer() {
        return this.#requestMessage(MODULE_NAME.PLAYER, ACTION_NAME_QA.GET_PLAYER).then(({ player }) => {
            if (player?.isAuthorized) {
                this._playerId = player.userId
                this._isPlayerAuthorized = player.isAuthorized
                this._playerName = player.name
                if (Array.isArray(player.photos)) {
                    this._playerPhotos = [...player.photos]
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

    #handleAdvertisement({ action, payload }) {
        if (action === 'interstitial') {
            if (!this.isInterstitialSupported) {
                return
            }
            switch (payload.status) {
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
        } else if (action === 'reward') {
            if (!this.isRewardedSupported) {
                return
            }
            switch (payload.status) {
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
        }
    }

    #isPlatformInternalStorageAvailable() {
        return (this._internalStoragePolicy === INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY && this._isPlayerAuthorized)
            || this._internalStoragePolicy === INTERNAL_STORAGE_POLICY.ALWAYS
    }

    #updateDefaultStorageType() {
        if (this.#isPlatformInternalStorageAvailable()) {
            this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
        } else {
            this._defaultStorageType = STORAGE_TYPE.LOCAL_STORAGE
        }
    }

    #cleanCache() {
        if (this.engine === 'unity') {
            indexedDB.deleteDatabase('UnityCache')
        }
    }
}

export default QaToolPlatformBridge
