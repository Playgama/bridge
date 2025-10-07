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

import EventLite from 'event-lite'
import {
    PLATFORM_ID,
    EVENT_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    ERROR,
    VISIBILITY_STATE,
    DEVICE_TYPE,
    LEADERBOARD_TYPE,
} from '../constants'
import PromiseDecorator from '../common/PromiseDecorator'
import StateAggregator from '../common/StateAggregator'
import { getGuestUser, showInfoPopup } from '../common/utils'

class PlatformBridgeBase {
    get options() {
        return this._options
    }

    // platform
    get platformId() {
        return PLATFORM_ID.MOCK
    }

    get platformSdk() {
        return this._platformSdk
    }

    get platformLanguage() {
        const value = navigator.language
        if (typeof value === 'string') {
            return value.substring(0, 2).toLowerCase()
        }

        return 'en'
    }

    get platformPayload() {
        const url = new URL(window.location.href)
        return url.searchParams.get('payload')
    }

    get platformTld() {
        return null
    }

    get isPlatformGetAllGamesSupported() {
        return false
    }

    get isPlatformGetGameByIdSupported() {
        return false
    }

    get isPlatformAudioEnabled() {
        if (this._audioStateAggregator) {
            return !this._audioStateAggregator.getAggregatedState()
        }

        return true
    }

    get isPlatformPaused() {
        if (this._pauseStateAggregator) {
            return this._pauseStateAggregator.getAggregatedState()
        }

        return false
    }

    // game
    get visibilityState() {
        return this._visibilityState
    }

    // player
    get isPlayerAuthorizationSupported() {
        return false
    }

    get isPlayerAuthorized() {
        return this._isPlayerAuthorized
    }

    get playerId() {
        return this._playerId
    }

    get playerName() {
        return this._playerName
    }

    get playerPhotos() {
        return this._playerPhotos
    }

    get playerExtra() {
        return this._playerExtra
    }

    // storage
    get defaultStorageType() {
        return this._defaultStorageType
    }

    // advertisement
    get isBannerSupported() {
        return this._isBannerSupported
    }

    get isInterstitialSupported() {
        return false
    }

    get isMinimumDelayBetweenInterstitialEnabled() {
        return true
    }

    get isRewardedSupported() {
        return false
    }

    // social
    get isInviteFriendsSupported() {
        return false
    }

    get isJoinCommunitySupported() {
        return false
    }

    get isShareSupported() {
        return false
    }

    get isCreatePostSupported() {
        return false
    }

    get isAddToHomeScreenSupported() {
        return false
    }

    get isAddToFavoritesSupported() {
        return false
    }

    get isRateSupported() {
        return false
    }

    get isExternalLinksAllowed() {
        return true
    }

    // device
    get deviceType() {
        if (navigator && navigator.userAgent) {
            const userAgent = navigator.userAgent.toLowerCase()
            if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
                return DEVICE_TYPE.MOBILE
            }

            if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP)))/.test(userAgent)) {
                return DEVICE_TYPE.TABLET
            }
        }

        return DEVICE_TYPE.DESKTOP
    }

    // payments
    get isPaymentsSupported() {
        return false
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NOT_AVAILABLE
    }

    // config
    get isRemoteConfigSupported() {
        return false
    }

    // clipboard
    get isClipboardSupported() {
        return true
    }

    // achievements
    get isAchievementsSupported() {
        return false
    }

    get isGetAchievementsListSupported() {
        return false
    }

    get isAchievementsNativePopupSupported() {
        return false
    }

    _isInitialized = false

    _platformSdk = null

    _isPlayerAuthorized = false

    _playerId = null

    _playerName = null

    _playerPhotos = []

    _playerExtra = {}

    _visibilityState = null

    _localStorage = null

    _defaultStorageType = STORAGE_TYPE.LOCAL_STORAGE

    _platformStorageCachedData = null

    _isBannerSupported = false

    _paymentsPurchases = []

    _pauseStateAggregator = null

    _audioStateAggregator = null

    #promiseDecorators = { }

    constructor(options) {
        try { this._localStorage = window.localStorage } catch (e) {
            // Nothing we can do with it
        }

        this._visibilityState = document.visibilityState

        const aggregationStates = ['interstitial', 'rewarded', 'visibility', 'platform']
        this._pauseStateAggregator = new StateAggregator(
            aggregationStates,
            (isPaused) => this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, isPaused),
        )

        this._audioStateAggregator = new StateAggregator(
            aggregationStates,
            (isDisabled) => this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, !isDisabled),
        )

        document.addEventListener('visibilitychange', () => {
            this._setVisibilityState(document.visibilityState)
        })

        window.addEventListener('blur', () => {
            this._setVisibilityState(VISIBILITY_STATE.HIDDEN)
        })

        window.addEventListener('focus', () => {
            this._setVisibilityState(VISIBILITY_STATE.VISIBLE)
        })

        if (options) {
            this._options = { ...options }
        }
    }

    initialize() {
        return Promise.resolve()
    }

    // platform
    sendMessage() {
        return Promise.resolve()
    }

    getServerTime() {
        return new Promise((resolve, reject) => {
            fetch('https://playgama.com/api/v1/timestamp/now')
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok')
                    }
                    return response.json()
                })
                .then((data) => {
                    resolve(data.timestamp * 1000)
                })
                .catch(() => {
                    reject()
                })
        })
    }

    getAllGames() {
        return Promise.reject()
    }

    getGameById() {
        return Promise.reject()
    }

    // player
    authorizePlayer() {
        return Promise.reject()
    }

    // storage
    isStorageSupported(storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                return this._localStorage !== null
            }
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                return false
            }
            default: {
                return false
            }
        }
    }

    isStorageAvailable(storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                return this._localStorage !== null
            }
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                return false
            }
            default: {
                return false
            }
        }
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        const values = []

                        for (let i = 0; i < key.length; i++) {
                            values.push(this._getDataFromLocalStorage(key[i], tryParseJson))
                        }

                        return Promise.resolve(values)
                    }

                    const value = this._getDataFromLocalStorage(key, tryParseJson)
                    return Promise.resolve(value)
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    setDataToStorage(key, value, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            this._setDataToLocalStorage(key[i], value[i])
                        }
                        return Promise.resolve()
                    }

                    this._setDataToLocalStorage(key, value)
                    return Promise.resolve()
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    deleteDataFromStorage(key, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            this._deleteDataFromLocalStorage(key[i])
                        }
                        return Promise.resolve()
                    }

                    this._deleteDataFromLocalStorage(key)
                    return Promise.resolve()
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    // advertisement
    showBanner() {
        this._setBannerState(BANNER_STATE.FAILED)
    }

    hideBanner() {
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    preloadInterstitial() { }

    showInterstitial() {
        this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
    }

    preloadRewarded() { }

    showRewarded() {
        this._setRewardedState(REWARDED_STATE.FAILED)
    }

    checkAdBlock() {
        const fakeAd = document.createElement('div')
        fakeAd.className = 'textads banner-ads banner_ads ad-unit ad-zone ad-space adsbox'
        fakeAd.style.position = 'absolute'
        fakeAd.style.left = '-9999px'
        fakeAd.style.width = '1px'
        fakeAd.style.height = '1px'
        document.body.appendChild(fakeAd)

        const REQUEST_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

        const REQUEST_CONFIG = {
            method: 'HEAD',
            mode: 'no-cors',
        }

        return new Promise((resolve) => {
            fetch(REQUEST_URL, REQUEST_CONFIG)
                .then((response) => {
                    if (response.redirected) {
                        resolve(response.redirected)
                    } else {
                        window.setTimeout(() => {
                            const result = fakeAd.offsetHeight === 0 || window.getComputedStyle(fakeAd)?.display === 'none'
                            resolve(result)
                            fakeAd.remove()
                        }, 100)
                    }
                })
                .catch(() => {
                    resolve(true)
                })
        })
    }

    // social
    inviteFriends() {
        return Promise.reject()
    }

    joinCommunity() {
        return Promise.reject()
    }

    share() {
        return Promise.reject()
    }

    createPost() {
        return Promise.reject()
    }

    addToHomeScreen() {
        return Promise.reject()
    }

    addToFavorites() {
        return Promise.reject()
    }

    rate() {
        return Promise.reject()
    }

    // leaderboards
    leaderboardsSetScore() {
        return Promise.reject()
    }

    leaderboardsGetEntries() {
        return Promise.reject()
    }

    leaderboardsShowNativePopup() {
        return Promise.reject()
    }

    // payments
    paymentsPurchase(id) {
        if (this.isPaymentsSupported) {
            const purchase = { id }
            this._paymentsPurchases.push(purchase)
            return Promise.resolve(purchase)
        }

        return Promise.reject()
    }

    paymentsConsumePurchase(id) {
        if (this.isPaymentsSupported) {
            const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
            if (purchaseIndex < 0) {
                return Promise.reject()
            }

            this._paymentsPurchases.splice(purchaseIndex, 1)
            return Promise.resolve({ id })
        }

        return Promise.reject()
    }

    paymentsGetCatalog() {
        if (this.isPaymentsSupported) {
            return Promise.resolve(this._paymentsGetProductsPlatformData())
        }

        return Promise.reject()
    }

    paymentsGetPurchases() {
        if (this.isPaymentsSupported) {
            return Promise.resolve(this._paymentsPurchases)
        }

        return Promise.reject()
    }

    // config
    getRemoteConfig() {
        return Promise.reject()
    }

    // clipboard
    clipboardRead() {
        if (window.navigator && window.navigator.clipboard) {
            return window.navigator.clipboard.readText()
        }

        return Promise.reject()
    }

    clipboardWrite(text) {
        if (window.navigator && window.navigator.clipboard) {
            return window.navigator.clipboard.writeText(text)
        }

        return Promise.reject()
    }

    // achievements
    unlockAchievement() {
        return Promise.reject()
    }

    getAchievementsList() {
        return Promise.reject()
    }

    showAchievementsNativePopup() {
        return Promise.reject()
    }

    _getDataFromLocalStorage(key, tryParseJson) {
        let value = this._localStorage.getItem(key)

        if (tryParseJson && typeof value === 'string') {
            try {
                value = JSON.parse(value)
            } catch (e) {
                // Nothing we can do with it
            }
        }

        return value
    }

    _setDataToLocalStorage(key, value) {
        this._localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value)
    }

    _deleteDataFromLocalStorage(key) {
        this._localStorage.removeItem(key)
    }

    _setVisibilityState(state) {
        if (this._visibilityState === state) {
            return
        }

        this._visibilityState = state
        this.emit(EVENT_NAME.VISIBILITY_STATE_CHANGED, this._visibilityState)

        const isHidden = state === VISIBILITY_STATE.HIDDEN
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('visibility', isHidden)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('visibility', isHidden)
        }
    }

    _setBannerState(state) {
        this.emit(EVENT_NAME.BANNER_STATE_CHANGED, state)
    }

    _setInterstitialState(state) {
        this.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, state)

        const isActive = state === INTERSTITIAL_STATE.OPENED
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('interstitial', isActive)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('interstitial', isActive)
        }
    }

    _setRewardedState(state) {
        this.emit(EVENT_NAME.REWARDED_STATE_CHANGED, state)

        const isActive = state === REWARDED_STATE.OPENED || state === REWARDED_STATE.REWARDED
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('rewarded', isActive)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('rewarded', isActive)
        }
    }

    _setAudioState(isEnabled) {
        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('platform', !isEnabled)
        } else {
            this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled)
        }
    }

    _setPauseState(isPaused) {
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('platform', isPaused)
        } else {
            this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, isPaused)
        }
    }

    _createPromiseDecorator(actionName) {
        const promiseDecorator = new PromiseDecorator()
        this.#promiseDecorators[actionName] = promiseDecorator
        return promiseDecorator
    }

    _getPromiseDecorator(actionName) {
        return this.#promiseDecorators[actionName]
    }

    _resolvePromiseDecorator(id, data) {
        if (this.#promiseDecorators[id]) {
            this.#promiseDecorators[id].resolve(data)
            delete this.#promiseDecorators[id]
        }
    }

    _rejectPromiseDecorator(id, error) {
        if (this.#promiseDecorators[id]) {
            this.#promiseDecorators[id].reject(error)
            delete this.#promiseDecorators[id]
        }
    }

    _paymentsGetProductsPlatformData() {
        if (!this._options.payments) {
            return []
        }

        return this._options.payments
            .map((product) => {
                const mergedProduct = {
                    ...product[this.platformId],
                }

                mergedProduct.platformProductId = mergedProduct.id
                mergedProduct.id = product.id

                return mergedProduct
            })
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

        const mergedProduct = {
            ...product[this.platformId],
        }

        mergedProduct.platformProductId = mergedProduct.id
        mergedProduct.id = product.id

        return mergedProduct
    }

    _paymentsGenerateTransactionId(id) {
        return `${id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    }

    _advertisementShowErrorPopup(isRewarded) {
        const useBuiltInErrorPopup = this._options?.advertisement?.useBuiltInErrorPopup
        if (useBuiltInErrorPopup) {
            return showInfoPopup('Oops! It looks like you closed the ad too early, or it isn\'t available right now.')
                .then(() => {
                    if (isRewarded) {
                        this._setRewardedState(REWARDED_STATE.FAILED)
                    } else {
                        this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                    }
                })
        }

        if (isRewarded) {
            this._setRewardedState(REWARDED_STATE.FAILED)
        } else {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
        }

        return Promise.resolve()
    }

    _playerApplyGuestData() {
        const guest = getGuestUser()
        this._playerId = guest.id
        this._playerName = guest.name
    }
}

EventLite.mixin(PlatformBridgeBase.prototype)
export default PlatformBridgeBase
