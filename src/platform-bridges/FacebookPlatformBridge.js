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
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.8.0.js'

class FacebookPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.FACEBOOK
    }

    get platformLanguage() {
        return this._platformLanguage
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // device
    get deviceType() {
        switch (this._platformSdk && this._platformSdk.getPlatform()) {
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
    get isPlayerAuthorizationSupported() {
        return true
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    // social
    get isInviteFriendsSupported() {
        return this._supportedApis.includes('inviteAsync')
    }

    get isShareSupported() {
        return this._supportedApis.includes('shareAsync')
    }

    _contextId = null

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
                    this._isPlayerAuthorized = true
                    this._playerId = this._platformSdk.player.getID()
                    this._contextId = this._platformSdk.context.getID()

                    const language = this._platformSdk.getLocale()
                    if (language && language.length > 2) {
                        this._platformLanguage = language.substring(0, 2).toLowerCase()
                    }

                    this._supportedApis = this._platformSdk.getSupportedAPIs()

                    this._isInitialized = true
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
            return this._supportedApis.includes('player.getDataAsync')
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
    showBanner(position, placement) {
        this._platformSdk.loadBannerAdAsync(placement, position)
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

    preloadInterstitial(placement) {
        this.#preloadInterstitial(placement)
    }

    showInterstitial(placement) {
        this.#preloadInterstitial(placement)
            .then((preloadedInterstitial) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return preloadedInterstitial.showAsync()
            })
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => this._advertisementShowErrorPopup(false))
            .finally(() => {
                this.#preloadInterstitial(placement, true)
            })
    }

    preloadRewarded(placement) {
        this.#preloadRewarded(placement)
    }

    showRewarded(placement) {
        this.#preloadRewarded(placement)
            .then((preloadedRewarded) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return preloadedRewarded.showAsync()
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => this._advertisementShowErrorPopup(true))
            .finally(() => {
                this.#preloadRewarded(placement, true)
            })
    }

    // leaderboards
    leaderboardsSetScore(id, score) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            this._platformSdk.globalLeaderboards.setScoreAsync(id, score)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            this._platformSdk.globalLeaderboards.getTopEntriesAsync(id, 10)
                .then((result) => {
                    let entries = null
                    let rank = 0

                    if (result && result.entries.length > 0) {
                        entries = result.entries.map((e) => {
                            const entryPlayer = e.getPlayer()
                            const entryRank = rank
                            rank += 1
                            return {
                                rank: entryRank,
                                score: e.getScore(),
                                id: entryPlayer.getID(),
                                name: entryPlayer.getName(),
                                photo: entryPlayer.getPhoto(),
                            }
                        })
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
    paymentsPurchase(id) {
        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.payments.purchaseAsync({ productID: product.id })
                .then((purchase) => {
                    const mergedPurchase = { id, ...purchase }
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

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.payments.consumePurchaseAsync(this._paymentsPurchases[purchaseIndex].purchaseToken)
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
                        const facebookProduct = facebookProducts.find((p) => p.productID === product.id)

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

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.payments.getPurchasesAsync()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)
                        const mergedPurchase = {
                            id: product.id,
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

            this._platformSdk.shareAsync({
                intent: 'REQUEST',
                ...options,
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
