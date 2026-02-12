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
    DEVICE_TYPE,
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
    get deviceType() {
        if (this.#systemInfo) {
            const { platform } = this.#systemInfo
            if (platform === 'ios' || platform === 'android') {
                return DEVICE_TYPE.MOBILE
            }
        }

        return super.deviceType
    }

    // clipboard
    get isClipboardSupported() {
        return false
    }

    #systemInfo = null

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
                    this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                }

                if (this._platformSdk.canIUse('getSystemInfoSync')) {
                    this.#systemInfo = this._platformSdk.getSystemInfoSync()
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
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (this._platformSdk.canIUse('getStorage')) {
                return true
            }

            return false
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (this._platformSdk.canIUse('getStorage')) {
                return true
            }

            return false
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (Array.isArray(key)) {
                    const promises = key.map((k) => this.#getStorageItem(k, tryParseJson))
                    Promise.all(promises)
                        .then((values) => resolve(values))
                        .catch((error) => reject(error))
                    return
                }

                this.#getStorageItem(key, tryParseJson)
                    .then((value) => resolve(value))
                    .catch((error) => reject(error))
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (Array.isArray(key)) {
                    const promises = key.map((k, i) => this.#setStorageItem(k, value[i]))
                    Promise.all(promises)
                        .then(() => resolve())
                        .catch((error) => reject(error))
                    return
                }

                this.#setStorageItem(key, value)
                    .then(() => resolve())
                    .catch((error) => reject(error))
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (Array.isArray(key)) {
                    const promises = key.map((k) => this.#removeStorageItem(k))
                    Promise.all(promises)
                        .then(() => resolve())
                        .catch((error) => reject(error))
                    return
                }

                this.#removeStorageItem(key)
                    .then(() => resolve())
                    .catch((error) => reject(error))
            })
        }

        return super.deleteDataFromStorage(key, storageType)
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

    #getStorageItem(key, tryParseJson) {
        return new Promise((resolve, reject) => {
            this._platformSdk.getStorage({
                key,
                success: (result) => {
                    let { data } = result
                    if (tryParseJson && typeof data === 'string') {
                        try {
                            data = JSON.parse(data)
                        } catch (e) {
                            // Nothing we can do with it
                        }
                    }
                    resolve(data)
                },
                fail: (error) => {
                    reject(error)
                },
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
