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

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.8.0.js'

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

    // social
    get isInviteFriendsSupported() {
        return this._supportedApis.includes('inviteAsync')
    }

    get isShareSupported() {
        return this._supportedApis.includes('shareAsync')
    }

    _contextId = null

    _bannerPlacementId = null

    _interstitialPlacements = []

    _rewardedPlacements = []

    _isPlayerAuthorized = true

    _supportedApis = []

    _preloadedInterstitialPromises = {}

    _preloadedRewardedPromises = {}

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

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
                    this._bannerPlacementId = this._options.bannerPlacementId || null
                    this._interstitialPlacements = this._options.interstitialPlacements || []
                    this._rewardedPlacements = this._options.rewardedPlacements || []

                    this._playerId = this._platformSdk.player.getID()

                    this._contextId = this._platformSdk.context.getID()

                    const language = this._platformSdk.getLocale()

                    if (language && language.length > 2) {
                        this._platformLanguage = language.substring(0, 2).toLowerCase()
                    }

                    this._supportedApis = this._platformSdk.getSupportedAPIs()

                    this._isInitialized = true

                    for (let i = 0; i < this._interstitialPlacements.length; i++) {
                        const interstitialPlacement = this._interstitialPlacements[i]
                        this.#preloadInterstitial(interstitialPlacement.id)
                    }

                    for (let i = 0; i < this._rewardedPlacements.length; i++) {
                        const rewardedPlacement = this._rewardedPlacements[i]
                        this.#preloadRewarded(rewardedPlacement.id)
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((e) => this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e))
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

    showInterstitial(placementId) {
        const _placementId = placementId || this._interstitialPlacements[0]?.id

        this.#preloadInterstitial(_placementId)
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
                this.#preloadInterstitial(_placementId, true)
            })
    }

    showRewarded(placementId) {
        const _placementId = placementId || this._rewardedPlacements[0]?.id

        this.#preloadRewarded(_placementId)
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
                this.#preloadRewarded(_placementId, true)
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
    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.payments.purchaseAsync(product)
                .then((purchase) => {
                    const mergedPurchase = { commonId: id, ...purchase }
                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, purchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.commonId === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.payments.consumePurchaseAsync(this._paymentsPurchases[purchaseIndex].purchaseToken)
                .then((result) => {
                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.payments.getCatalogAsync()
                .then((facebookProducts) => {
                    const mergedProducts = products.map((product) => {
                        const facebookProduct = facebookProducts.find((p) => p.productID === product.productID)

                        return {
                            commonId: product.commonId,
                            productID: facebookProduct.productID,
                            description: facebookProduct.description,
                            imageURI: facebookProduct.imageURI,
                            price: facebookProduct.price,
                            priceCurrencyCode: facebookProduct.priceCurrencyCode,
                            priceValue: facebookProduct.priceAmount,
                            title: facebookProduct.title,
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

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.payments.getPurchasesAsync()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)
                        return {
                            commonId: product.commonId,
                            ...purchase,
                        }
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

    #preloadInterstitial(placementId, forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedInterstitialPromises[placementId]) {
            return this._preloadedInterstitialPromises[placementId]
        }

        let preloadedInterstitial = null

        this._preloadedInterstitialPromises[placementId] = this._platformSdk.getInterstitialAdAsync(placementId)
            .then((interstitial) => {
                preloadedInterstitial = interstitial
                return interstitial.loadAsync()
            })
            .then(() => preloadedInterstitial)
            .catch(() => {
                this._preloadedInterstitialPromises[placementId] = null
                return Promise.reject()
            })

        return this._preloadedInterstitialPromises[placementId]
    }

    #preloadRewarded(placementId, forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedRewardedPromises[placementId]) {
            return this._preloadedRewardedPromises[placementId]
        }

        let preloadedRewarded = null

        this._preloadedRewardedPromises[placementId] = this._platformSdk.getRewardedVideoAsync(placementId)
            .then((rewarded) => {
                preloadedRewarded = rewarded
                return rewarded.loadAsync()
            })
            .then(() => preloadedRewarded)
            .catch(() => {
                this._preloadedRewardedPromises[placementId] = null
                return Promise.reject()
            })

        return this._preloadedRewardedPromises[placementId]
    }
}

export default FacebookPlatformBridge
