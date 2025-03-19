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
import { addJavaScript, isBase64Image, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
} from '../constants'

const Platform = {
    IOS: 'IOS',
    ANDROID: 'ANDROID',
    WEB: 'WEB',
    MOBILE_WEB: 'MOBILE_WEB',
}

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.7.1.js'

class FacebookPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.FACEBOOK
    }

    get platformLanguage() {
        return this._platformLanguage
    }

    // device
    get deviceType() {
        switch (this._platformSdk && this._platformSdk.getPlatform()) {
            case Platform.IOS:
            case Platform.MOBILE_WEB:
            case Platform.ANDROID: {
                return DEVICE_TYPE.MOBILE
            }
            case Platform.WEB: {
                return DEVICE_TYPE.DESKTOP
            }
            default: {
                return super.deviceType
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    get isPlayerAuthorized() {
        return this._isPlayerAuthorized
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    // leaderboard
    get isLeaderboardSupported() {
        return this._supportedApis.includes('getLeaderboardAsync')
    }

    get isLeaderboardMultipleBoardsSupported() {
        return this._supportedApis.includes('getLeaderboardAsync')
    }

    get isLeaderboardSetScoreSupported() {
        return this._supportedApis.includes('getLeaderboardAsync')
    }

    get isLeaderboardGetScoreSupported() {
        return this._supportedApis.includes('getLeaderboardAsync')
    }

    get isLeaderboardGetEntriesSupported() {
        return this._supportedApis.includes('getLeaderboardAsync')
    }

    // payments
    get isPaymentsSupported() {
        return this._supportedApis.includes('payments.purchaseAsync')
    }

    get isGetCatalogSupported() {
        return this._supportedApis.includes('payments.getCatalogAsync')
    }

    get isGetPurchasesSupported() {
        return this._supportedApis.includes('payments.getPurchasesAsync')
    }

    get isConsumePurchaseSupported() {
        return this._supportedApis.includes('payments.consumePurchaseAsync')
    }

    // social
    get isInviteFriendsSupported() {
        return this._supportedApis.includes('inviteAsync')
    }

    get isShareSupported() {
        return this._supportedApis.includes('shareAsync')
    }

    _contextId = null

    _bannerPlacementId = null

    _interstitialPlacementId = null

    _rewardedPlacementId = null

    _leaderboardId = null

    _isPlayerAuthorized = true

    _supportedApis = []

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('FBInstant'))
                .then(() => {
                    this._platformSdk = window.FBInstant
                    return this._platformSdk.initializeAsync()
                })
                .then(() => {
                    this._bannerPlacementId = this._options.bannerPlacementId
                    this._interstitialPlacementId = this._options.interstitialPlacementId
                    this._rewardedPlacementId = this._options.rewardedPlacementId

                    this._playerId = this._platformSdk.player.getID()
                    this._playerName = this._platformSdk.player.getName()
                    this._playerPhotos.push(this._platformSdk.player.getPhoto())

                    this._contextId = this._platformSdk.context.getID()
                    this._platformLanguage = this._platformSdk.getLocale()

                    this._supportedApis = this._platformSdk.getSupportedAPIs()

                    this._isInitialized = true

                    this.#preloadInterstitial()
                    this.#preloadRewarded()

                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((e) => this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, e))
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.setLoadingProgress(100)
                return new Promise((resolve) => {
                    this._platformSdk.startGameAsync().then(resolve)
                })
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // player
    authorizePlayer() {
        return Promise.resolve()
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._supportedApis.includes('getDataAsync')
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const keys = Array.isArray(key) ? key : [key]

                this._platformSdk.player.getDataAsync(keys)
                    .then((userData) => {
                        const data = keys.map((_key) => {
                            const value = userData[_key]
                            return !tryParseJson && typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? null
                        })

                        resolve(data)
                    })
                    .catch(reject)
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = value[i]
                    }
                } else {
                    data[key] = value
                }

                this._platformSdk.player.setDataAsync(data)
                    .then(resolve)
                    .catch(reject)
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = null
                    }
                } else {
                    data[key] = null
                }

                this._platformSdk.player.setDataAsync(data)
                    .then(resolve)
                    .catch(reject)
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showBanner(options) {
        this._platformSdk.loadBannerAdAsync(this._bannerPlacementId, options)
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        this._platformSdk.hideBannerAdAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    showInterstitial() {
        this.#preloadInterstitial()
            .then((preloadedInterstitial) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return preloadedInterstitial.showAsync()
            })
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            })
            .finally(() => {
                this.#preloadInterstitial(true)
            })
    }

    showRewarded() {
        this.#preloadRewarded()
            .then((preloadedRewarded) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return preloadedRewarded.showAsync()
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            })
            .finally(() => {
                this.#preloadRewarded(true)
            })
    }

    // leaderboard
    setLeaderboardScore(options) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        if (!options || !options.score || !options.leaderboardName) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)

            this._platformSdk.getLeaderboardAsync(options.leaderboardName)
                .then((leaderboard) => leaderboard.setScoreAsync(
                    options.score,
                    options.extraData
                        ? JSON.stringify(options.extraData)
                        : null,
                ))
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    getLeaderboardScore(options) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        if (!options || !options.leaderboardName) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_SCORE)

            this._platformSdk.getLeaderboardAsync(options.leaderboardName)
                .then((leaderboard) => leaderboard.getPlayerEntryAsync())
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_LEADERBOARD_SCORE, result.getScore())
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    getLeaderboardEntries(options) {
        if (!options || !options.leaderboardName) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES)

            const parameters = [
                options.count ?? 5,
                options.offset ?? 0,
            ]

            this._platformSdk.getLeaderboardAsync(options.leaderboardName)
                .then((leaderboard) => leaderboard.getConnectedPlayerEntriesAsync(...parameters))
                .then((result) => {
                    let entries = null

                    if (result && result.entries.length > 0) {
                        entries = result.entries.map((e) => (
                            {
                                rank: e.rank,
                                score: e.score,
                                format_score: e.format_score,
                                ts: e.ts,
                                extra_data: e.extra_data,
                                playerId: e.player.player_id,
                                playerName: e.player.name,
                                playerPhoto: e.player.photo,
                            }))
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES, entries)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_LEADERBOARD_ENTRIES, error)
                })
        }

        return promiseDecorator.promise
    }

    // payments
    purchase(options) {
        if (!options.productID) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.payments.purchaseAsync({
                productID: options.productID,
                developerPayload: options.developerPayload ? JSON.stringify(options.developerPayload) : undefined,
            })
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    getPaymentsPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.payments.getPurchasesAsync()
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    getPaymentsCatalog() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.payments.getCatalogAsync()
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    consumePurchase(options) {
        if (!options.purchaseToken) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.payments.consumePurchaseAsync(options.purchaseToken)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
        }
        return promiseDecorator.promise
    }

    // social
    inviteFriends(options = {}) {
        if (!options.image || !options.text) {
            return Promise.reject()
        }

        if (!isBase64Image(options.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this._platformSdk.inviteAsync(options)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, error)
                })
        }

        return promiseDecorator.promise
    }

    share(options) {
        if (!options.image || !options.text) {
            return Promise.reject()
        }

        if (!isBase64Image(options.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this._platformSdk.shareAsync(options)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }

    #preloadedInterstitialPromise = null

    #preloadInterstitial(forciblyPreload = false) {
        if (!forciblyPreload && this.#preloadedInterstitialPromise) {
            return this.#preloadedInterstitialPromise
        }

        let preloadedInterstitial = null

        this.#preloadedInterstitialPromise = this._platformSdk.getInterstitialAdAsync(this._interstitialPlacementId)
            .then((interstitial) => {
                preloadedInterstitial = interstitial
                return interstitial.loadAsync()
            })
            .then(() => preloadedInterstitial)
            .catch(() => {
                this.#preloadedInterstitialPromise = null
                return Promise.reject()
            })

        return this.#preloadedInterstitialPromise
    }

    #preloadedRewardedPromise = null

    #preloadRewarded(forciblyPreload = false) {
        if (!forciblyPreload && this.#preloadedRewardedPromise) {
            return this.#preloadedRewardedPromise
        }

        let preloadedRewarded = null

        this.#preloadedRewardedPromise = this._platformSdk.getRewardedVideoAsync(this._rewardedPlacementId)
            .then((rewarded) => {
                preloadedRewarded = rewarded
                return rewarded.loadAsync()
            })
            .then(() => preloadedRewarded)
            .catch(() => {
                this.#preloadedRewardedPromise = null
                return Promise.reject()
            })

        return this.#preloadedRewardedPromise
    }
}

export default FacebookPlatformBridge
