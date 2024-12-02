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
import {
    PLATFORM_ID,
    MODULE_NAME,
    ACTION_NAME,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
} from '../constants'

const ADVERTISEMENT_TYPE = {
    INTERSTITIAL: 'interstitial',
    REWARD: 'reward',
    BANNER: 'banner',
}

const MODULE_NAME_QA = {
    LIVENESS: 'liveness',
}

const ACTION_NAME_QA = {
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
}

const INTERSTITIAL_STATUS = {
    START: 'start',
    OPEN: 'open',
    SHOW: 'show',
    CLOSE: 'close',
}
const REWARD_STATUS = {
    START: 'start',
    OPEN: 'open',
    REWARDED: 'rewarded',
    CLOSE: 'close',
}

const SUPPORTED_FEATURES = {
    PLAYER_AUTHORIZATION: 'isPlayerAuthorizationSupported',
    PAYMENTS: 'isPaymentsSupported',
    GET_CATALOG: 'isGetCatalogSupported',
    GET_PURCHASES: 'isGetPurchasesSupported',
    CONSUME_PURCHASE: 'isConsumePurchaseSupported',
    REMOTE_CONFIG: 'isRemoteConfigSupported',
    INVITE_FRIENDS: 'isInviteFriendsSupported',
    JOIN_COMMUNITY: 'isJoinCommunitySupported',
    SHARE: 'isShareSupported',
    CREATE_POST: 'isCreatePostSupported',
    ADD_TO_HOME_SCREEN: 'isAddToHomeScreenSupported',
    ADD_TO_FAVORITES: 'isAddToFavoritesSupported',
    RATE: 'isRateSupported',
    LEADERBOARD: 'isLeaderboardSupported',
    LEADERBOARD_MULTIPLE_BOARDS: 'isLeaderboardMultipleBoardsSupported',
    LEADERBOARD_SET_SCORE: 'isLeaderboardSetScoreSupported',
    LEADERBOARD_GET_SCORE: 'isLeaderboardGetScoreSupported',
    LEADERBOARD_GET_ENTRIES: 'isLeaderboardGetEntriesSupported',
    LEADERBOARD_NATIVE_POPUP: 'isLeaderboardNativePopupSupported',
    STORAGE_INTERNAL: 'isStorageInternalSupported',
    STORAGE_LOCAL: 'isStorageLocalSupported',
    BANNER: 'isBannerSupported',
    CLIPBOARD: 'isClipboardSupported',
    ACHIEVEMENTS: 'isAchievementsSupported',
    ACHIEVEMENTS_GET_LIST: 'isGetAchievementsListSupported',
    ACHIEVEMENTS_NATIVE_POPUP: 'isAchievementsNativePopupSupported',
}

class QaToolPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.QA_TOOL
    }

    // player
    get isPlayerAuthorizationSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PLAYER_AUTHORIZATION)
    }

    // payments
    get isPaymentsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.PAYMENTS)
    }

    get isGetCatalogSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.GET_CATALOG)
    }

    get isGetPurchasesSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.GET_PURCHASES)
    }

    get isConsumePurchaseSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.CONSUME_PURCHASE)
    }

    // config
    get isRemoteConfigSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.REMOTE_CONFIG)
    }

    // social
    get isInviteFriendsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.INVITE_FRIENDS)
    }

    get isJoinCommunitySupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.JOIN_COMMUNITY)
    }

    get isShareSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.SHARE)
    }

    get isCreatePostSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.CREATE_POST)
    }

    get isAddToHomeScreenSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ADD_TO_HOME_SCREEN)
    }

    get isAddToFavoritesSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ADD_TO_FAVORITES)
    }

    get isRateSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.RATE)
    }

    // leaderboard
    get isLeaderboardSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD)
    }

    get isLeaderboardMultipleBoardsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD_MULTIPLE_BOARDS)
    }

    get isLeaderboardSetScoreSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD_SET_SCORE)
    }

    get isLeaderboardGetScoreSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD_GET_SCORE)
    }

    get isLeaderboardGetEntriesSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD_GET_ENTRIES)
    }

    get isLeaderboardNativePopupSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.LEADERBOARD_NATIVE_POPUP)
    }

    // clipboard
    get isClipboardSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.CLIPBOARD)
    }

    // achievements
    get isAchievementsSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS)
    }

    get isGetAchievementsListSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.GET_ACHIEVEMENTS_LIST)
    }

    get isAchievementsNativePopupSupported() {
        return this._supportedFeatures.includes(SUPPORTED_FEATURES.ACHIEVEMENTS_NATIVE_POPUP)
    }

    #messageBroker = new MessageBroker()

    _supportedFeatures = []

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

            const messageHandler = ({ data }) => {
                if (data?.type === MODULE_NAME.PLATFORM && data.action === ACTION_NAME.INITIALIZE) {
                    this._supportedFeatures = data.supportedFeatures
                    this._isBannerSupported = this._supportedFeatures.includes(SUPPORTED_FEATURES.BANNER)

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)

                    this.#messageBroker.send({
                        type: MODULE_NAME_QA.LIVENESS,
                        action: ACTION_NAME_QA.LIVENESS_PING,
                        options: { version: PLUGIN_VERSION },
                    })
                }
            }

            this.#messageBroker.addListener(messageHandler)
            this.#messageBroker.send({
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME.INITIALIZE,
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PLAYER
                    && data.action === ACTION_NAME.AUTHORIZE_PLAYER
                    && data.id === messageId
                ) {
                    const { player } = data

                    this._isPlayerAuthorized = true

                    this._playerId = player.userId
                    this._playerName = player.name

                    if (player.profilePictureUrl) {
                        this._playerPhotos = [player.profilePictureUrl]
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PLAYER,
                action: ACTION_NAME.AUTHORIZE_PLAYER,
                id: messageId,
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        const actions = [
            PLATFORM_MESSAGE.GAME_READY,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
            PLATFORM_MESSAGE.GAMEPLAY_STARTED,
            PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
            PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT,
            PLATFORM_MESSAGE.GAME_OVER,
        ]

        if (actions.includes(message)) {
            this.#messageBroker.send({
                type: MODULE_NAME.PLATFORM,
                action: message,
            })

            return Promise.resolve()
        }

        return super.sendMessage(message)
    }

    getServerTime() {
        return new Promise((resolve, reject) => {
            let timeoutId
            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PLATFORM
                    && data.action === ACTION_NAME_QA.GET_SERVER_TIME
                    && data.id === messageId
                ) {
                    if (!data.time) {
                        reject(new Error('Invalid server time'))
                        return
                    }
                    clearTimeout(timeoutId)
                    resolve(data.time)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME_QA.GET_SERVER_TIME,
                id: messageId,
            })

            timeoutId = setTimeout(() => {
                reject(new Error('Server time request timeout'))
                this.#messageBroker.removeListener(messageHandler)
            }, 5_000)
        })
    }

    // storage
    isStorageSupported(storageType) {
        this.#messageBroker.send({
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
        this.#messageBroker.send({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.IS_STORAGE_AVAILABLE,
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

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const messageId = this.#messageBroker.generateMessageId()

            return new Promise((resolve) => {
                const messageHandler = ({ data }) => {
                    if (
                        data?.type === MODULE_NAME.STORAGE
                        && data.action === ACTION_NAME_QA.GET_DATA_FROM_STORAGE
                        && data.id === messageId
                    ) {
                        const values = Object.values(data.storage)
                        resolve(values)
                        this.#messageBroker.removeListener(messageHandler)
                    }
                }

                this.#messageBroker.addListener(messageHandler)

                this.#messageBroker.send({
                    type: MODULE_NAME.STORAGE,
                    action: ACTION_NAME_QA.GET_DATA_FROM_STORAGE,
                    id: messageId,
                    options: { key, storageType, tryParseJson },
                })
            })
        }

        this.#messageBroker.send({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.GET_DATA_FROM_STORAGE,
            options: { key, storageType, tryParseJson },
        })

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        this.#messageBroker.send({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.SET_DATA_TO_STORAGE,
            options: { key, value, storageType },
        })

        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return Promise.resolve()
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        this.#messageBroker.send({
            type: MODULE_NAME.STORAGE,
            action: ACTION_NAME_QA.DELETE_DATA_FROM_STORAGE,
            options: { key, storageType },
        })

        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial() {
        const showInterstitialHandler = ({ data }) => {
            if (data?.type !== MODULE_NAME.ADVERTISEMENT) {
                return
            }

            switch (data.payload.status) {
                case INTERSTITIAL_STATUS.START:
                    this._setInterstitialState(INTERSTITIAL_STATE.LOADING)
                    break
                case INTERSTITIAL_STATUS.OPEN:
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case INTERSTITIAL_STATUS.CLOSE:
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    this.#messageBroker.removeListener(showInterstitialHandler)
                    break
                default:
                    break
            }
        }

        this.#messageBroker.addListener(showInterstitialHandler)

        this.#messageBroker.send({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.INTERSTITIAL,
        })
    }

    showRewarded() {
        const showRewardedHandler = ({ data }) => {
            if (data?.type !== MODULE_NAME.ADVERTISEMENT) {
                return
            }

            switch (data.payload.status) {
                case REWARD_STATUS.START:
                    this._setRewardedState(REWARDED_STATE.LOADING)
                    break
                case REWARD_STATUS.OPEN:
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    break
                case REWARD_STATUS.REWARDED:
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    break
                case REWARD_STATUS.CLOSE:
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    this.#messageBroker.removeListener(showRewardedHandler)
                    break
                default:
                    break
            }
        }

        this.#messageBroker.addListener(showRewardedHandler)

        this.#messageBroker.send({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.REWARD,
        })
    }

    showBanner() {
        this._setBannerState(BANNER_STATE.SHOWN)

        this.#messageBroker.send({
            type: MODULE_NAME.ADVERTISEMENT,
            action: BANNER_STATE.SHOWN,
            options: { type: ADVERTISEMENT_TYPE.BANNER },
        })
    }

    hideBanner() {
        this._setBannerState(BANNER_STATE.HIDDEN)

        this.#messageBroker.send({
            type: MODULE_NAME.ADVERTISEMENT,
            action: BANNER_STATE.HIDDEN,
            options: { type: ADVERTISEMENT_TYPE.BANNER },
        })
    }

    checkAdBlock() {
        this.#messageBroker.send({
            type: ACTION_NAME_QA.CHECK_ADBLOCK,
            action: ACTION_NAME.ADBLOCK_DETECT,
        })

        return super.checkAdBlock()
    }

    // social
    inviteFriends() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.INVITE_FRIENDS,
            })
        }

        return promiseDecorator.promise
    }

    joinCommunity() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.JOIN_COMMUNITY,
            })
        }

        return promiseDecorator.promise
    }

    share() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this._resolvePromiseDecorator(ACTION_NAME.SHARE)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.SHARE,
            })
        }

        return promiseDecorator.promise
    }

    createPost() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.CREATE_POST,
            })
        }

        return promiseDecorator.promise
    }

    addToHomeScreen() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.ADD_TO_HOME_SCREEN,
            })
        }

        return promiseDecorator.promise
    }

    addToFavorites() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)

            this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.ADD_TO_FAVORITES,
            })
        }

        return promiseDecorator.promise
    }

    rate() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE)

            this._resolvePromiseDecorator(ACTION_NAME.RATE)

            this.#messageBroker.send({
                type: MODULE_NAME.SOCIAL,
                action: ACTION_NAME.RATE,
            })
        }

        return promiseDecorator.promise
    }

    // payments
    purchase() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PAYMENTS
                    && data.action === ACTION_NAME.PURCHASE
                    && data.id === messageId
                ) {
                    if (!data.purchase || typeof data.purchase !== 'object') {
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, new Error('Invalid purchase'))
                        return
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, data.purchase)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PAYMENTS,
                action: ACTION_NAME.PURCHASE,
                id: messageId,
            })
        }

        return promiseDecorator.promise
    }

    getPaymentsPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PAYMENTS
                    && data.action === ACTION_NAME.GET_PURCHASES
                    && data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, data.purchases)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PAYMENTS,
                action: ACTION_NAME.GET_PURCHASES,
                id: messageId,
            })
        }

        return promiseDecorator.promise
    }

    getPaymentsCatalog() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PAYMENTS
                    && data.action === ACTION_NAME.GET_CATALOG
                    && data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, data.catalog)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PAYMENTS,
                action: ACTION_NAME.GET_CATALOG,
                id: messageId,
            })
        }

        return promiseDecorator.promise
    }

    consumePurchase() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.PAYMENTS
                    && data.action === ACTION_NAME.CONSUME_PURCHASE
                    && data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, data.result)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.PAYMENTS,
                action: ACTION_NAME.CONSUME_PURCHASE,
                id: messageId,
            })
        }
        return promiseDecorator.promise
    }

    // config
    getRemoteConfig() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.REMOTE_CONFIG
                    && data.action === ACTION_NAME.GET_REMOTE_CONFIG
                    && data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, data.result)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.REMOTE_CONFIG,
                action: ACTION_NAME.GET_REMOTE_CONFIG,
                id: messageId,
            })
        }

        return promiseDecorator.promise
    }

    // clipboard
    clipboardWrite(text) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.CLIPBOARD
                    && data.action === ACTION_NAME.CLIPBOARD_WRITE
                    && data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, true)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.CLIPBOARD,
                action: ACTION_NAME.CLIPBOARD_WRITE,
                id: messageId,
                options: { text },
            })
        }

        return promiseDecorator.promise
    }

    clipboardRead() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.CLIPBOARD
                    && data.action === ACTION_NAME_QA.CLIPBOARD_READ
                    && data.id === messageId
                ) {
                    const { text } = data
                    this._resolvePromiseDecorator(ACTION_NAME_QA.CLIPBOARD_READ, text)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.CLIPBOARD,
                action: ACTION_NAME_QA.CLIPBOARD_READ,
                id: messageId,
                options: {},
            })
        }

        return promiseDecorator.promise
    }

    // leaderboard
    setLeaderboardScore(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)

            const scoreOptions = { ...options }
            if (typeof scoreOptions.score === 'string') {
                scoreOptions.score = parseInt(scoreOptions.score, 10)
            }

            this.#messageBroker.send({
                type: MODULE_NAME.LEADERBOARD,
                action: ACTION_NAME.SET_LEADERBOARD_SCORE,
                options: scoreOptions,
            })

            this._resolvePromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
        }

        return promiseDecorator.promise
    }

    getLeaderboardScore(options) {
        const leaderboardName = options?.yandex?.leaderboardName
        const decoratorKey = `${ACTION_NAME.GET_LEADERBOARD_SCORE}_${leaderboardName}`

        let promiseDecorator = this._getPromiseDecorator(decoratorKey)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(decoratorKey)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.LEADERBOARD
                    && data.action === ACTION_NAME.GET_LEADERBOARD_SCORE
                    && data.id === messageId
                    && data.leaderboardName === leaderboardName
                ) {
                    this._resolvePromiseDecorator(decoratorKey, data.score)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.LEADERBOARD,
                action: ACTION_NAME.GET_LEADERBOARD_SCORE,
                id: messageId,
                leaderboardName,
                options,
            })
        }

        return promiseDecorator.promise
    }

    getLeaderboardEntries(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES)

            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = (event) => {
                if (
                    event.data?.type === MODULE_NAME.LEADERBOARD
                    && event.data.action === ACTION_NAME.GET_LEADERBOARD_ENTRIES
                    && event.data.id === messageId
                ) {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES, event.data.entries)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.LEADERBOARD,
                action: ACTION_NAME.GET_LEADERBOARD_ENTRIES,
                id: messageId,
                options,
            })
        }

        return promiseDecorator.promise
    }

    showLeaderboardNativePopup(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHOW_LEADERBOARD_NATIVE_POPUP)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHOW_LEADERBOARD_NATIVE_POPUP)

            this.#messageBroker.send({
                type: MODULE_NAME.LEADERBOARD,
                action: ACTION_NAME.SHOW_LEADERBOARD_NATIVE_POPUP,
                options,
            })

            this._resolvePromiseDecorator(ACTION_NAME.SHOW_LEADERBOARD_NATIVE_POPUP)
        }

        return promiseDecorator.promise
    }

    // achievements
    unlockAchievement(options) {
        return new Promise((resolve) => {
            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.ACHIEVEMENTS
                    && data.action === ACTION_NAME_QA.UNLOCK_ACHIEVEMENT
                    && data.id === messageId
                ) {
                    resolve(data.result)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.ACHIEVEMENTS,
                action: ACTION_NAME_QA.UNLOCK_ACHIEVEMENT,
                id: messageId,
                options,
            })
        })
    }

    getAchievementsList(options) {
        return new Promise((resolve) => {
            const messageId = this.#messageBroker.generateMessageId()

            const messageHandler = ({ data }) => {
                if (
                    data?.type === MODULE_NAME.ACHIEVEMENTS
                    && data.action === ACTION_NAME_QA.GET_ACHIEVEMENTS
                    && data.id === messageId
                ) {
                    resolve(data.result)
                    this.#messageBroker.removeListener(messageHandler)
                }
            }

            this.#messageBroker.addListener(messageHandler)

            this.#messageBroker.send({
                type: MODULE_NAME.ACHIEVEMENTS,
                action: ACTION_NAME_QA.GET_ACHIEVEMENTS,
                id: messageId,
                options,
            })
        })
    }

    showAchievementsNativePopup() {
        this.#messageBroker.send({
            type: MODULE_NAME.ACHIEVEMENTS,
            action: ACTION_NAME_QA.SHOW_ACHIEVEMENTS_NATIVE_POPUP,
        })

        return Promise.resolve()
    }
}

export default QaToolPlatformBridge
