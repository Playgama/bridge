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
import { waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    LEADERBOARD_TYPE,
} from '../constants'

class GameSnacksPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.GAMESNACKS
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    _isBannerSupported = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('GameSnacks').then(() => {
                this._platformSdk = window.GameSnacks
                this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message, options = {}) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.game.ready()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAME_OVER: {
                this._platformSdk.game.gameOver()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.LEVEL_COMPLETE: {
                const level = Number(options.level)
                if (!Number.isFinite(level)) {
                    return Promise.reject(new Error('Level is required for level_complete message'))
                }

                this._platformSdk.game.levelComplete(level)
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // advertisement
    showInterstitial(placement) {
        this._platformSdk.ad.break({
            type: 'next',
            name: placement || 'interstitial',
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if (this.interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo?.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }

    showRewarded(placement) {
        this._platformSdk.ad.break({
            type: 'reward',
            name: placement || 'rewarded',
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if (this.rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn) => {
                showAdFn()
            },
            adDismissed: () => {
                this._showAdFailurePopup(true)
            },
            adViewed: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo?.breakStatus === 'frequencyCapped' || placementInfo?.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
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
            if (Array.isArray(key)) {
                const values = key.map((storageKey) => this.#parseStorageValue(
                    this._platformSdk.storage.getItem(storageKey),
                    tryParseJson,
                ))
                return Promise.resolve(values)
            }

            const value = this.#parseStorageValue(this._platformSdk.storage.getItem(key), tryParseJson)
            return Promise.resolve(value)
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    this._platformSdk.storage.setItem(key[i], this.#toStorageString(value[i]))
                }
                return Promise.resolve()
            }

            this._platformSdk.storage.setItem(key, this.#toStorageString(value))
            return Promise.resolve()
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    this._platformSdk.storage.removeItem(key[i])
                }
                return Promise.resolve()
            }

            this._platformSdk.storage.removeItem(key)
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // leaderboards
    leaderboardsSetScore(_, score) {
        return this._platformSdk.score.update(score)
    }

    #toStorageString(value) {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value)
        }

        if (typeof value === 'string') {
            return value
        }

        return String(value)
    }

    #parseStorageValue(value, tryParseJson) {
        if (!tryParseJson || typeof value !== 'string') {
            return value
        }

        try {
            return JSON.parse(value)
        } catch (e) {
            return value
        }
    }
}

export default GameSnacksPlatformBridge
