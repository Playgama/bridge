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
} from '../constants'

const SDK_URL = 'https://gtg.samsungapps.com/gsinstant-sdk/gsinstant.0.45.js'

class SamsungPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.SAMSUNG
    }

    get platformLanguage() {
        return this._platformLanguage || super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // social
    get isAddToHomeScreenSupported() {
        return this.#canCreateShortCut
    }

    get isExternalLinksAllowed() {
        return false
    }

    _platformLanguage = null

    #canCreateShortCut = false

    #isAdInitialized = false

    #currentAdIsRewarded = false

    #isAdShowing = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const loadSdk = typeof window.GSInstant !== 'undefined'
                ? Promise.resolve()
                : addJavaScript(SDK_URL)

            loadSdk
                .then(() => waitFor('GSInstant'))
                .then(() => {
                    this._platformSdk = window.GSInstant
                    return this._platformSdk.initializeAsync()
                })
                .then((result) => {
                    if (result && result.err) {
                        throw new Error(`Samsung initializeAsync failed: ${result.err}`)
                    }

                    const locale = this._platformSdk.getLocale()
                    if (typeof locale === 'string' && locale.length >= 2) {
                        this._platformLanguage = locale.substring(0, 2).toLowerCase()
                    }

                    const shortcutCheck = this._platformSdk.canCreateShortCut()
                    this.#canCreateShortCut = Boolean(shortcutCheck) && !shortcutCheck.err

                    this._platformSdk.setOnPauseCallback(() => {
                        this._setPauseState(true)
                    })

                    this._platformSdk.setOnResumeCallback(() => {
                        this._setPauseState(false)
                    })

                    return this.#fetchPlayerData()
                })
                .then(() => {
                    this.#initializeAds()
                    return this._platformSdk.startGameAsync()
                })
                .then((result) => {
                    if (result && result.err) {
                        throw new Error(`Samsung startGameAsync failed: ${result.err}`)
                    }

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.loginAsync()
                .catch((error) => {
                    // Samsung rejects with {err: 'ALREADY_LOGGED_IN'} when the session
                    // is already authenticated — treat as success and proceed to fetch playerId.
                    if (error && error.err === 'ALREADY_LOGGED_IN') {
                        return undefined
                    }
                    throw error
                })
                .then(() => this._platformSdk.player.getPlayerIdAsync())
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
                .catch((error) => {
                    // Samsung loginAsync rejects with {err: '...'} objects;
                    // getPlayerIdAsync rejects with raw strings. Normalize to Error.
                    const message = (error && error.err) || (typeof error === 'string' ? error : 'samsung_auth_failed')
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, new Error(message))
                })
        }

        return promiseDecorator.promise
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
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
            const keys = Array.isArray(key) ? key : [key]

            return this._platformSdk.getDataAsync(keys)
                .then((data) => {
                    if (Array.isArray(key)) {
                        return key.map((k) => this.#readStorageValue(data, k, tryParseJson))
                    }

                    return this.#readStorageValue(data, key, tryParseJson)
                })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const dataObj = {}

            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    dataObj[key[i]] = this.#serializeStorageValue(value[i])
                }
            } else {
                dataObj[key] = this.#serializeStorageValue(value)
            }

            return this._platformSdk.setDataAsync(dataObj)
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const keys = Array.isArray(key) ? key : [key]
            const dataObj = {}
            for (let i = 0; i < keys.length; i++) {
                dataObj[keys[i]] = null
            }

            return this._platformSdk.setDataAsync(dataObj)
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    preloadInterstitial() {
        if (!this.#isAdInitialized) {
            return
        }

        const result = this._platformSdk.advertisement2.loadAd({ adFormat: 'INTERSTITIAL' })
        if (result && result.err) {
            console.warn('Samsung loadAd(INTERSTITIAL) error:', result.err)
        }
    }

    showInterstitial() {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(false)
            return
        }

        this.#currentAdIsRewarded = false
        this.#isAdShowing = true
        const result = this._platformSdk.advertisement2.showAd({ adFormat: 'INTERSTITIAL' })
        if (result && result.err) {
            console.warn('Samsung showAd(INTERSTITIAL) error:', result.err)
            this.#isAdShowing = false
            this._showAdFailurePopup(false)
        }
    }

    preloadRewarded() {
        if (!this.#isAdInitialized) {
            return
        }

        const result = this._platformSdk.advertisement2.loadAd({ adFormat: 'REWARD' })
        if (result && result.err) {
            console.warn('Samsung loadAd(REWARD) error:', result.err)
        }
    }

    showRewarded() {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(true)
            return
        }

        this.#currentAdIsRewarded = true
        this.#isAdShowing = true
        const result = this._platformSdk.advertisement2.showAd({ adFormat: 'REWARD' })
        if (result && result.err) {
            console.warn('Samsung showAd(REWARD) error:', result.err)
            this.#isAdShowing = false
            this._showAdFailurePopup(true)
        }
    }

    // social
    addToHomeScreen() {
        const result = this._platformSdk.createShortCut()
        if (result && result.err) {
            return Promise.reject(new Error(result.err))
        }

        return Promise.resolve()
    }

    #fetchPlayerData() {
        const loginStatus = this._platformSdk.getLoginStatus()
        if (loginStatus && !loginStatus.err && loginStatus.result === 'LOGIN') {
            return this._platformSdk.player.getPlayerIdAsync()
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                })
                .catch(() => {
                    this._isPlayerAuthorized = false
                    this._playerApplyGuestData()
                })
        }

        this._isPlayerAuthorized = false
        this._playerApplyGuestData()
        return Promise.resolve()
    }

    #initializeAds() {
        const ads = this._platformSdk.advertisement2
        if (!ads || typeof ads.initAd !== 'function') {
            console.warn('Samsung advertisement2 API not available on this Galaxy Store Client')
            return
        }

        const adOptions = {}
        if (this._options.samsungInterstitialAdPlacementId) {
            adOptions.samsungInterstitialAdPlacementId = this._options.samsungInterstitialAdPlacementId
        }
        if (this._options.samsungRewardedAdPlacementId) {
            adOptions.samsungRewardedAdPlacementId = this._options.samsungRewardedAdPlacementId
        }
        if (this._options.admobInterstitialAdUnitId) {
            adOptions.admobInterstitialAdUnitId = this._options.admobInterstitialAdUnitId
        }
        if (this._options.admobRewardedAdUnitId) {
            adOptions.admobRewardedAdUnitId = this._options.admobRewardedAdUnitId
        }
        if (this._options.gameTitle) {
            adOptions.gameTitle = this._options.gameTitle
        }

        if (Object.keys(adOptions).length === 0) {
            return
        }

        const result = ads.initAd(adOptions)
        if (result && result.err) {
            console.warn('Samsung ad init error:', result.err)
            return
        }

        this.#isAdInitialized = true

        ads.addEventListener('AD_START', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        })

        ads.addEventListener('AD_COMPLETE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_SKIP', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_CLOSE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_LOAD_ERROR', () => {
            // Preload failures fire here before any show call — stay silent.
            // Only surface as a failure if the game already requested a show.
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_SHOW_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_VIDEO_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })
    }

    // eslint-disable-next-line class-methods-use-this
    #readStorageValue(data, key, tryParseJson) {
        let value = data && data[key] !== undefined ? data[key] : null
        if (tryParseJson && typeof value === 'string') {
            try {
                value = JSON.parse(value)
            } catch (_) {
                // keep value as is
            }
        }

        return value
    }

    // eslint-disable-next-line class-methods-use-this
    #serializeStorageValue(value) {
        if (value !== null && typeof value === 'object') {
            return JSON.stringify(value)
        }

        return value
    }
}

export default SamsungPlatformBridge
