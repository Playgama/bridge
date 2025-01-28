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
    PLATFORM_MESSAGE,
    ERROR,
} from '../constants'

const SDK_URL = 'https://gtg.samsungapps.com/gsinstant-sdk/gsinstant.0.44.js'

class SamsungPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.SAMSUNG
    }

    get platformLanguage() {
        return this._platformLanguage
    }

    get isPlayerAuthorizationSupported() {
        return true
    }

    _supportedApis = []

    _advertisementPlayType = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)
            if (
                !this._options
                || !this._options.samsungInterstitalAdPlacementId
                || !this._options.samsungRewardedAdPlacementId
                || !this._options.admobInterstitalAdUnitId
                || !this._options.admobRewardedAdUnitId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.SAMSUNG_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addJavaScript(SDK_URL)
                    .then(() => waitFor('GSInstant'))
                    .then(() => {
                        this._platformSdk = window.GSInstant
                        return this._platformSdk.initializeAsync()
                    })
                    .then(() => {
                        this.#initAds()
                        this._platformLanguage = this._platformSdk.getLocale()
                        this._supportedApis = this._platformSdk.getSupportedAPIs()

                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                    .catch((e) => this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, e))
            }
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

    setDataToStorage(storageType, key, value) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const data = {}

            if (Array.isArray(key)) {
                key.forEach((k, i) => {
                    data[k] = value[i]
                })
            } else {
                data[key] = value
            }

            return this._platformSdk.setDataAsync(data)
        }

        return super.setDataToStorage(storageType, key, value)
    }

    getDataFromStorage(storageType, key) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                this._platformSdk.getDataAsync(key)
                    .then((data) => {
                        if (Array.isArray(key)) {
                            resolve(key.map((k) => data[k]))
                        } else {
                            resolve(data[key])
                        }
                    })
                    .catch(reject)
            })
        }

        return super.getDataFromStorage(storageType, key)
    }

    // advertisement
    showInterstitial() {
        this._advertisementPlayType = 'INTERSTITIAL'
        const advertisementObj = this._platformSdk.advertisement2.loadAd({
            adFormat: this._advertisementPlayType,
        })

        if (advertisementObj.err) {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }

        this._platformSdk.advertisement2.showAd({
            adFormat: this._advertisementPlayType,
        })
    }

    showRewarded() {
        this._advertisementPlayType = 'REWARD'
        const advertisementObj = this._platformSdk.advertisement2.loadAd({
            adFormat: this._advertisementPlayType,
        })

        if (advertisementObj.err) {
            this._setInterstitialState(REWARDED_STATE.FAILED)
            return
        }

        this._platformSdk.advertisement2.showAd({
            adFormat: this._advertisementPlayType,
        })
    }

    #initAds() {
        this._platformSdk.advertisement2.init({
            samsungInterstitalAdPlacementId: this._options.samsungInterstitalAdPlacementId,
            samsungRewardedAdPlacementId: this._options.samsungRewardedAdPlacementId,
            admobInterstitalAdUnitId: this._options.admobInterstitalAdUnitId,
            admobRewardedAdUnitId: this._options.admobRewardedAdUnitId,
        })

        this._platformSdk.advertisement2.addEventListener('AD_LOADED', () => { })
        this._platformSdk.advertisement2.addEventListener('AD_LOAD_ERROR', () => {
            if (this._advertisementPlayType === 'INTERSTITIAL') {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        })
        this._platformSdk.advertisement2.addEventListener('AD_SHOW_ERROR', () => {
            if (this._advertisementPlayType === 'INTERSTITIAL') {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        })
        this._platformSdk.advertisement2.addEventListener('AD_CLOSE', () => {
            if (this._advertisementPlayType === 'INTERSTITIAL') {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            } else if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            }
        })
        this._platformSdk.advertisement2.addEventListener('AD_START', () => {
            if (this._advertisementPlayType === 'INTERSTITIAL') {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            } else if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.OPENED)
            }
        })
        this._platformSdk.advertisement2.addEventListener('AD_COMPLETE', () => {
            if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            }
        })
        this._platformSdk.advertisement2.addEventListener('AD_SKIP', () => { })
        this._platformSdk.advertisement2.addEventListener('AD_VIDEO_ERROR', () => {
            if (this._advertisementPlayType === 'INTERSTITIAL') {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else if (this._advertisementPlayType === 'REWARD') {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        })
    }
}

export default SamsungPlatformBridge
