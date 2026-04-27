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
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    DEVICE_OS,
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

    get deviceOs() {
        switch (this.#platform) {
            case 'android':
            case 'android_x': {
                return DEVICE_OS.ANDROID
            }
            case 'ios': {
                return DEVICE_OS.IOS
            }
            case 'macos': {
                return DEVICE_OS.MACOS
            }
            default: {
                return super.deviceOs
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady() {
        return Promise.resolve()
    }

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    _isPlayerAuthorized = true

    #platform

    #adsController

    #rewardedListeners = {
        onStart: () => this._setRewardedState(REWARDED_STATE.OPENED),
        onSkip: () => this._setRewardedState(REWARDED_STATE.CLOSED),
        onReward: () => this._setRewardedState(REWARDED_STATE.REWARDED),
        onError: () => this._showAdFailurePopup(true),
    }

    #interstitialListeners = {
        onStart: () => this._setInterstitialState(INTERSTITIAL_STATE.OPENED),
        onSkip: () => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED),
        onError: () => this._showAdFailurePopup(false),
    }

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
    loadCloudSnapshot() {
        return new Promise((resolve, reject) => {
            this._platformSdk.CloudStorage.getKeys((keysError, keys) => {
                if (keysError) {
                    reject(keysError)
                    return
                }

                if (!keys || keys.length === 0) {
                    resolve({})
                    return
                }

                this._platformSdk.CloudStorage.getItems(keys, (itemsError, values) => {
                    if (itemsError) {
                        reject(itemsError)
                        return
                    }
                    resolve(values || {})
                })
            })
        })
    }

    saveCloudSnapshot(snapshot, changedKeys) {
        return Promise.all(changedKeys.map((k) => new Promise((resolve, reject) => {
            this._platformSdk.CloudStorage.setItem(k, snapshot[k], (error) => {
                if (error) reject(error)
                else resolve()
            })
        })))
    }

    deleteCloudKeys(snapshot, deletedKeys) {
        return Promise.all(deletedKeys.map((k) => new Promise((resolve, reject) => {
            this._platformSdk.CloudStorage.removeItem(k, (error) => {
                if (error) reject(error)
                else resolve()
            })
        })))
    }

    // advertisement
    showInterstitial() {
        if (!this.#adsController) {
            this._showAdFailurePopup(false)
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
            this._showAdFailurePopup(true)
            return
        }
        this.#adsController.addEventListener('onStart', this.#rewardedListeners.onStart)
        this.#adsController.addEventListener('onSkip', this.#rewardedListeners.onSkip)
        this.#adsController.addEventListener('onReward', this.#rewardedListeners.onReward)
        this.#adsController.addEventListener('onError', this.#rewardedListeners.onError)
        this.#adsController.addEventListener('onBannerNotFound', this.#rewardedListeners.onError)
        this.#adsController.show().finally(() => {
            this.#adsController.removeEventListener('onStart', this.#rewardedListeners.onStart)
            this.#adsController.removeEventListener('onSkip', this.#rewardedListeners.onSkip)
            this.#adsController.removeEventListener('onReward', this.#rewardedListeners.onReward)
            this.#adsController.removeEventListener('onError', this.#rewardedListeners.onError)
            this.#adsController.removeEventListener('onBannerNotFound', this.#rewardedListeners.onError)
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
}

export default TelegramPlatformBridge
