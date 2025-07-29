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
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'

class GamePushPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.GAMEPUSH
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    _isBannerSupported = true

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
                const SDK_URL = `https://gamepush.com/sdk/game-score.js?projectId=${this._options.projectId}&publicToken=${this._options.publicToken}`
                addJavaScript(SDK_URL).then(() => {
                    waitFor('GamePush').then(() => {
                        this._platformSdk = window.GamePush
                        const player = this._platformSdk?.player
                        if (player) {
                            const { id = null, name = '', avatar = '' } = player
                            this._isPlayerAuthorized = true
                            this._playerId = id
                            this._playerName = name

                            if (avatar) {
                                this._playerPhotos.push(avatar)
                            }
                        }

                        this._isInitialized = true

                        this.#setupInterstitialHandlers()
                        this.#setupRewardedHandlers()
                        this.#setupBannerHandlers()

                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    showInterstitial() {
        this._platformSdk.ads.showFullscreen()
    }

    showRewarded() {
        this._platformSdk.ads.showRewardedVideo()
            .catch(() => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            })
    }

    showBanner() {
        this._platformSdk.ads.showSticky()
    }

    hideBanner() {
        this._platformSdk.ads.closeSticky()
    }

    checkAdBlock() {
        return new Promise((resolve) => {
            this._platformSdk.ads.isAdblockEnabled().then((res) => {
                resolve(res)
            })
        })
    }

    #setupRewardedHandlers() {
        this._platformSdk.ads.on('rewarded:start', () => {
            this._setRewardedState(REWARDED_STATE.OPENED)
        })

        this._platformSdk.ads.on('rewarded:close', (success) => {
            if (!success) {
                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        })

        this._platformSdk.ads.on('rewarded:reward', () => {
            this._setRewardedState(REWARDED_STATE.REWARDED)
            this._setRewardedState(REWARDED_STATE.CLOSED)
        })
    }

    #setupInterstitialHandlers() {
        this._platformSdk.ads.on('fullscreen:start', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        })

        this._platformSdk.ads.on('fullscreen:close', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })
    }

    #setupBannerHandlers() {
        this._platformSdk.ads.on('sticky:render', () => {
            this._setBannerState(BANNER_STATE.SHOWN)
        })

        this._platformSdk.ads.on('sticky:close', () => {
            this._setBannerState(BANNER_STATE.HIDDEN)
        })
    }
}

export default GamePushPlatformBridge
