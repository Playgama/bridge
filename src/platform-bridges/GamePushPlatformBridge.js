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
    STORAGE_TYPE,
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'

class GamePushPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.GAMEPUSH
    }

    get isLeaderboardSupported() {
        return true
    }

    get isLeaderboardSetScoreSupported() {
        return true
    }

    // achievements
    get isAchievementsSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.projectId
                || !this._options.publicToken
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAMEPUSH_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                const SDK_URL = `https://gamepush.com/sdk/game-score.js?projectId=${this._options.projectId}&publicToken=${this._options.publicToken}&callback=onGPInit`
                addJavaScript(SDK_URL).then(() => {
                    waitFor('gp').then(() => {
                        console.info(window.gp)
                        console.info('gp initialized')
                        this._platformSdk = window.gp

                        this._platformSdk.init(this._options.devId, this._options.publisherId)

                        this._platformSdk.User.get((response) => {
                            const { id, name, avatar } = response?.user ?? {}

                            if (id > 0) {
                                this._playerId = id
                                this._playerName = name
                                this._playerPhotos.push(avatar)
                                this._isPlayerAuthorized = true
                            }

                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return false
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return false
        }

        return super.isStorageAvailable(storageType)
    }

    // advertisement
    showInterstitial() {
        this._setInterstitialState(INTERSTITIAL_STATE.OPENED)

        this._platformSdk.APIAds.show(() => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })
    }

    showRewarded() {
        this._setRewardedState(REWARDED_STATE.OPENED)
        const canShowReward = (success, showAdFn) => {
            if (success) {
                showAdFn()
            } else {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        }

        const rewardSuccess = (success) => {
            if (success) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        }

        this._platformSdk.GEvents.reward(canShowReward, rewardSuccess)
    }

    // leaderboard
    setLeaderboardScore(options) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        if (typeof options?.score === 'undefined' || !options?.boardId) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)

            const params = {
                score: typeof options.score === 'string'
                    ? parseInt(options.score, 10)
                    : options.score,
                board: options.boardId,
            }

            this._platformSdk.Scores.save(params, (response) => {
                if (response.success) {
                    this._resolvePromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.SET_LEADERBOARD_SCORE, response.errormsg)
                }
            })
        }

        return promiseDecorator.promise
    }

    // achievements
    unlockAchievement(options) {
        if (!options.achievement) {
            return Promise.reject()
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.Achievements.save(
                Array.isArray(options.achievement)
                    ? options.achievement
                    : [options.achievement],
                (response) => {
                    if (response.success) {
                        resolve(response)
                    } else {
                        reject(response.errormsg)
                    }
                },
            )
        })
    }
}

export default GamePushPlatformBridge
