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
import { getGuestUser, waitFor } from '../common/utils'
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
    VISIBILITY_STATE, ERROR,
} from '../constants'

class TikTokPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.TIKTOK
    }

    get platformLanguage() {
        if (this.#systemInfo) {
            return this.#systemInfo.language
        }

        return super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('login')) {
            return true
        }

        return false
    }

    // advertisement
    get isInterstitialSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('createInterstitialAd')) {
            return true
        }

        return false
    }

    get isRewardedSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('createRewardedVideoAd')) {
            return true
        }

        return false
    }

    // social
    get isAddToHomeScreenSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('addShortcut')) {
            return true
        }

        return false
    }

    get isAddToHomeScreenRewardSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('getShortcutMissionReward')) {
            return true
        }

        return false
    }

    get isAddToFavoritesSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('startEntranceMission')) {
            return true
        }

        return false
    }

    get isAddToFavoritesRewardSupported() {
        if (this._platformSdk && this._platformSdk.canIUse('getEntranceMissionReward')) {
            return true
        }

        return false
    }

    // device
    get safeArea() {
        if (this.#menuButtonRect) {
            return {
                top: this.#menuButtonRect.bottom,
                bottom: 0,
                left: 0,
                right: 0,
            }
        }

        return null
    }

    get deviceType() {
        if (this.#systemInfo) {
            const { platform } = this.#systemInfo
            if (platform === 'ios' || platform === 'android') {
                return DEVICE_TYPE.MOBILE
            }
        }

        return super.deviceType
    }

    get deviceOs() {
        if (this.#systemInfo) {
            const { platform } = this.#systemInfo

            if (platform === 'android') {
                return DEVICE_OS.ANDROID
            }
            if (platform === 'ios') {
                return DEVICE_OS.IOS
            }
        }

        return super.deviceOs
    }

    // clipboard
    get isClipboardSupported() {
        return false
    }

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady() {
        return Promise.resolve()
    }

    #systemInfo = null

    #menuButtonRect = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('TTMinis').then(() => {
                this._platformSdk = window.TTMinis.game

                if (this._options && this._options.clientKey) {
                    this._platformSdk.init({ clientKey: this._options.clientKey })
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
                    return
                }

                if (this._platformSdk.canIUse('getStorage')) {
                    this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                }

                if (this._platformSdk.canIUse('getSystemInfoSync')) {
                    this.#systemInfo = this._platformSdk.getSystemInfoSync()
                }

                if (this._platformSdk.canIUse('getMenuButtonBoundingClientRect')) {
                    this.#menuButtonRect = this._platformSdk.getMenuButtonBoundingClientRect()
                }

                if (this._platformSdk.canIUse('onShow')) {
                    this._platformSdk.onShow(() => {
                        this._setVisibilityState(VISIBILITY_STATE.VISIBLE)
                    })
                }

                if (this._platformSdk.canIUse('onHide')) {
                    this._platformSdk.onHide(() => {
                        this._setVisibilityState(VISIBILITY_STATE.HIDDEN)
                    })
                }

                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                if (this._platformSdk.canIUse('setLoadingProgress')) {
                    this._platformSdk.setLoadingProgress({ progress: 1 })
                }
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // player
    authorizePlayer() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.login({
                success: () => {
                    const guestUser = getGuestUser()
                    this._playerId = guestUser.id
                    this._playerName = guestUser.name
                    this._isPlayerAuthorized = true
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    // storage
    async loadCloudSnapshot() {
        let keys = []
        if (this._platformSdk.canIUse('getStorageInfoSync')) {
            const info = this._platformSdk.getStorageInfoSync()
            keys = info && info.keys ? info.keys : []
        }

        if (keys.length === 0) {
            return {}
        }

        const values = await Promise.all(keys.map((k) => this.#getStorageItemRaw(k)))
        const snapshot = {}
        keys.forEach((k, i) => {
            if (values[i] !== undefined && values[i] !== null) {
                snapshot[k] = values[i]
            }
        })
        return snapshot
    }

    saveCloudSnapshot(snapshot, changedKeys) {
        return Promise.all(changedKeys.map((k) => this.#setStorageItem(k, snapshot[k])))
    }

    deleteCloudKeys(snapshot, deletedKeys) {
        return Promise.all(deletedKeys.map((k) => this.#removeStorageItem(k)))
    }

    // advertisement
    showInterstitial(placement) {
        const interstitialAd = this._platformSdk.createInterstitialAd({
            adUnitId: placement,
        })

        interstitialAd.onClose(() => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })

        interstitialAd.onError(() => {
            this._showAdFailurePopup(false)
        })

        interstitialAd.show()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(placement) {
        const rewardedAd = this._platformSdk.createRewardedVideoAd({
            adUnitId: placement,
        })

        rewardedAd.onClose((res) => {
            if (res && res.isEnded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            }
            this._setRewardedState(REWARDED_STATE.CLOSED)
        })

        rewardedAd.onError(() => {
            this._showAdFailurePopup(true)
        })

        rewardedAd.show()
            .then(() => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            })
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    // social
    addToHomeScreen() {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this._platformSdk.addShortcut({
                success: () => {
                    this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    getAddToHomeScreenReward() {
        return new Promise((resolve, reject) => {
            this._platformSdk.getShortcutMissionReward({
                success: (result) => {
                    if (result?.canReceiveReward) {
                        resolve()
                    } else {
                        reject()
                    }
                },
                fail: () => {
                    reject()
                },
            })
        })
    }

    addToFavorites() {
        if (!this.isAddToFavoritesSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)

            this._platformSdk.startEntranceMission({
                success: () => {
                    this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    getAddToFavoritesReward() {
        return new Promise((resolve, reject) => {
            this._platformSdk.getEntranceMissionReward({
                success: (result) => {
                    if (result?.canReceiveReward) {
                        resolve()
                    } else {
                        reject()
                    }
                },
                fail: () => {
                    reject()
                },
            })
        })
    }

    #getStorageItemRaw(key) {
        return new Promise((resolve, reject) => {
            this._platformSdk.getStorage({
                key,
                success: (result) => resolve(result.data),
                fail: (error) => reject(error),
            })
        })
    }

    #setStorageItem(key, value) {
        return new Promise((resolve, reject) => {
            this._platformSdk.setStorage({
                key,
                data: typeof value === 'object' ? JSON.stringify(value) : value,
                success: () => {
                    resolve()
                },
                fail: (error) => {
                    reject(error)
                },
            })
        })
    }

    #removeStorageItem(key) {
        return new Promise((resolve, reject) => {
            this._platformSdk.removeStorage({
                key,
                success: () => {
                    resolve()
                },
                fail: (error) => {
                    reject(error)
                },
            })
        })
    }
}

export default TikTokPlatformBridge
