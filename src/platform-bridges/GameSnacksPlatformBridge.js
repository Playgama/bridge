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
    CLOUD_STORAGE_MODE,
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

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.LAZY
    }

    get cloudStorageReady() {
        return Promise.resolve()
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
                this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)

                this._platformSdk.game.onPause(() => {
                    this._setPauseState(true)
                })

                this._platformSdk.game.onResume(() => {
                    this._setPauseState(false)
                })

                this._platformSdk.audio.subscribe((isEnabled) => {
                    this._setAudioState(isEnabled)
                })

                this._platformSdk.game.firstFrameReady()
                this._setAudioState(this._platformSdk.audio.isEnabled)

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
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                this._platformSdk.game.gameOver()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.LEVEL_COMPLETED: {
                const level = Number(options.level)
                if (!Number.isFinite(level)) {
                    return Promise.reject(new Error('Level is required for level_completed message'))
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

    // advertisement - adblock detection
    checkAdBlock() {
        return Promise.resolve(false)
    }

    // storage
    loadCloudKey(key) {
        const value = this._platformSdk.storage.getItem(key)
        return Promise.resolve(value === undefined ? null : value)
    }

    saveCloudKey(key, value) {
        this._platformSdk.storage.setItem(key, value)
        return Promise.resolve()
    }

    deleteCloudKey(key) {
        this._platformSdk.storage.removeItem(key)
        return Promise.resolve()
    }

    // leaderboards
    leaderboardsSetScore(_, score) {
        return this._platformSdk.score.update(score)
    }
}

export default GameSnacksPlatformBridge
