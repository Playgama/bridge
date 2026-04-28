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
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type LeaderboardType,
} from '../constants'

const SDK_URL = 'https://lagged.com/api/rev-share/lagged.js'

interface LaggedUserResponse {
    user?: {
        id?: number
        name?: string
        avatar?: string
    }
}

interface LaggedScoresResponse {
    success: boolean
    errormsg?: string
}

interface LaggedAchievementsResponse {
    success: boolean
    errormsg?: string
}

interface LaggedSdk {
    init(devId: string, publisherId: string): void
    User: {
        get(callback: (response: LaggedUserResponse) => void): void
    }
    APIAds: {
        show(callback: () => void): void
    }
    GEvents: {
        reward(
            canShowReward: (success: boolean, showAdFn: () => void) => void,
            rewardSuccess: (success: boolean) => void,
        ): void
    }
    Scores: {
        save(params: { score: unknown; board: unknown }, callback: (response: LaggedScoresResponse) => void): void
    }
    Achievements: {
        save(achievements: unknown[], callback: (response: LaggedAchievementsResponse) => void): void
    }
}

declare global {
    interface Window {
        LaggedAPI?: LaggedSdk
    }
}

class LaggedPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.LAGGED
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    // achievements
    get isAchievementsSupported(): boolean {
        return true
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.devId
                || !this._options.publisherId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addJavaScript(SDK_URL).then(() => {
                    waitFor('LaggedAPI').then(() => {
                        this._platformSdk = window.LaggedAPI as LaggedSdk

                        const sdk = this._platformSdk as LaggedSdk
                        sdk.init(this._options.devId as string, this._options.publisherId as string)

                        sdk.User.get((response) => {
                            const { id, name, avatar } = response?.user ?? {}

                            if (typeof id === 'number' && id > 0) {
                                this._playerId = String(id)
                                this._playerName = name ?? null
                                if (avatar) {
                                    this._playerPhotos.push(avatar)
                                }
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

    // advertisement
    showInterstitial(): void {
        this._setInterstitialState(INTERSTITIAL_STATE.OPENED);
        (this._platformSdk as LaggedSdk).APIAds.show(() => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })
    }

    showRewarded(): void {
        this._setRewardedState(REWARDED_STATE.OPENED)
        const canShowReward = (success: boolean, showAdFn: () => void): void => {
            if (success) {
                showAdFn()
            } else {
                this._showAdFailurePopup(true)
            }
        }

        const rewardSuccess = (success: boolean): void => {
            if (success) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._showAdFailurePopup(true)
            }
        };
        (this._platformSdk as LaggedSdk).GEvents.reward(canShowReward, rewardSuccess)
    }

    // leaderboards
    leaderboardsSetScore(id: unknown, score: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const params = {
                score,
                board: id,
            };
            (this._platformSdk as LaggedSdk).Scores.save(params, (response) => {
                if (response.success) {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, response.errormsg)
                }
            })
        }

        return promiseDecorator.promise
    }

    // achievements
    unlockAchievement(options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as { achievement?: unknown }
        if (!opts.achievement) {
            return Promise.reject()
        }

        return new Promise((resolve, reject) => {
            (this._platformSdk as LaggedSdk).Achievements.save(
                Array.isArray(opts.achievement)
                    ? opts.achievement
                    : [opts.achievement],
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

export default LaggedPlatformBridge
