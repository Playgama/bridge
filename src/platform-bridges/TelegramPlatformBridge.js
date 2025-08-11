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
import { addJavaScript } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    REWARDED_STATE,
    INTERSTITIAL_STATE,
    STORAGE_TYPE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'
const ADS_SDK_URL = 'https://sad.adsgram.ai/js/sad.min.js'

class TelegramPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.TELEGRAM
    }

    get platformLanguage() {
        if (this._platformSdk) {
            return this._platformSdk.initDataUnsafe.user.language_code
        }

        return super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported() {
        return !!this.#adsController
    }

    get isRewardedSupported() {
        return !!this.#adsController
    }

    // device
    get deviceType() {
        switch (this.#platform) {
            case 'android':
            case 'android_x':
            case 'ios': {
                return DEVICE_TYPE.MOBILE
            }
            case 'tdesktop':
            case 'unigram':
            case 'macos': {
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

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    _isPlayerAuthorized = true

    #platform

    #adsController

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                this._platformSdk = window.Telegram.WebApp

                const { initDataUnsafe } = this._platformSdk
                const userData = initDataUnsafe.user

                this._playerId = userData.id
                this._playerName = [userData.first_name, userData.last_name].filter(Boolean).join(' ')
                this._playerPhotos = [userData.photo_url]

                this.#platform = this._platformSdk.platform

                this._isInitialized = true

                if (this._options && this._options.adsgramBlockId) {
                    addJavaScript(ADS_SDK_URL)
                        .then(() => {
                            this.#adsController = window.Adsgram.init({ blockId: this._options.adsgramBlockId })
                        })
                        .finally(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                } else {
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                }
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.ready()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
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
            return true
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (Array.isArray(key)) {
                    this._platformSdk.CloudStorage.getItems(key, (error, values) => {
                        if (error) {
                            reject(error)
                            return
                        }

                        const result = []

                        key.forEach((k) => {
                            let value = values[k]
                            if (tryParseJson && typeof value === 'string') {
                                try {
                                    value = JSON.parse(value)
                                } catch (e) {
                                    // Nothing we can do with it
                                }
                            }
                            result.push(value)
                        })

                        resolve(result)
                    })

                    return
                }

                this._platformSdk.CloudStorage.getItem(key, (error, value) => {
                    if (error) reject(error)

                    let result = value
                    if (tryParseJson && typeof result === 'string') {
                        try {
                            result = JSON.parse(result)
                        } catch (e) {
                            // Nothing we can do with it
                        }
                    }
                    resolve(result)
                })
            })
        }

        return super.getDataFromStorage(key, storageType)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const keys = Array.isArray(key) ? key : [key]
                const values = Array.isArray(value) ? value : [value]
                const valuesString = values.map((v) => {
                    if (typeof v !== 'string') {
                        return JSON.stringify(v)
                    }
                    return v
                })

                keys.forEach((k, i) => this._platformSdk.CloudStorage.setItem(k, valuesString[i]))

                resolve()
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const keys = Array.isArray(key) ? key : [key]

                keys.forEach((k) => this._platformSdk.CloudStorage.removeItem(k))

                resolve()
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial() {
        if (!this.#adsController) {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }
        this.#adsController.addEventListener('onStart', this.#interstitialListeners.onStart)
        this.#adsController.addEventListener('onSkip', this.#interstitialListeners.onSkip)
        this.#adsController.addEventListener('onError', this.#interstitialListeners.onError)
        this.#adsController.addEventListener('onBannerNotFound', this.#interstitialListeners.onError)
        this.#adsController.show().finally(() => {
            this.#adsController.removeEventListener('onStart', this.#interstitialListeners.onStart)
            this.#adsController.removeEventListener('onSkip', this.#interstitialListeners.onSkip)
            this.#adsController.removeEventListener('onError', this.#interstitialListeners.onError)
            this.#adsController.removeEventListener('onBannerNotFound', this.#interstitialListeners.onError)
        })
    }

    showRewarded() {
        if (!this.#adsController) {
            this._setRewardedState(REWARDED_STATE.FAILED)
            return
        }
        this.#adsController.addEventListener('onStart', this.#rewardedListeners.onStart)
        this.#adsController.addEventListener('onSkip', this.#rewardedListeners.onSkip)
        this.#adsController.addEventListener('onReward', this.#rewardedListeners.onReward)
        this.#adsController.addEventListener('onError', this.#rewardedListeners.onError)
        this.#adsController.addEventListener('onBannerNotFound', this.#rewardedListeners.onError)
        this.#adsController.show().finally(() => {
            this.#adsController.addEventListener('onStart', this.#rewardedListeners.onStart)
            this.#adsController.addEventListener('onSkip', this.#rewardedListeners.onSkip)
            this.#adsController.addEventListener('onReward', this.#rewardedListeners.onReward)
            this.#adsController.addEventListener('onError', this.#rewardedListeners.onError)
            this.#adsController.addEventListener('onBannerNotFound', this.#rewardedListeners.onError)
        })
    }

    // clipboard
    clipboardRead() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLIPBOARD_READ)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLIPBOARD_READ)

            this._platformSdk.readTextFromClipboard((text) => {
                if (text) {
                    this._resolvePromiseDecorator(ACTION_NAME.CLIPBOARD_READ, text)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.CLIPBOARD_READ)
                }
            })
        }

        return promiseDecorator.promise
    }

    #rewardedListeners = {
        onStart: () => this._setRewardedState(REWARDED_STATE.OPENED),
        onSkip: () => this._setRewardedState(REWARDED_STATE.CLOSED),
        onReward: () => this._setRewardedState(REWARDED_STATE.REWARDED),
        onError: () => this._setRewardedState(REWARDED_STATE.FAILED),
    }

    #interstitialListeners = {
        onStart: () => this._setInterstitialState(INTERSTITIAL_STATE.OPENED),
        onSkip: () => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED),
        onError: () => this._setInterstitialState(INTERSTITIAL_STATE.FAILED),
    }
}

export default TelegramPlatformBridge
