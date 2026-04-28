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
    type PlatformId,
} from '../constants'

interface GamePushAds {
    showFullscreen(): void
    showRewardedVideo(): Promise<unknown>
    showSticky(): void
    closeSticky(): void
    isAdblockEnabled(): Promise<boolean>
    on(event: string, callback: (arg?: unknown) => void): void
}

interface GamePushPlayer {
    id?: string | null
    name?: string
    avatar?: string
}

interface GamePushSdk {
    ads: GamePushAds
    player?: GamePushPlayer
}

declare global {
    interface Window {
        GamePush?: GamePushSdk
    }
}

class GamePushPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.GAMEPUSH
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    protected _isBannerSupported = true

    initialize(): Promise<unknown> {
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
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                const SDK_URL = `https://gamepush.com/sdk/game-score.js?projectId=${this._options.projectId}&publicToken=${this._options.publicToken}`
                addJavaScript(SDK_URL).then(() => {
                    waitFor('GamePush').then(() => {
                        this._platformSdk = window.GamePush as GamePushSdk
                        const player = (this._platformSdk as GamePushSdk)?.player
                        if (player) {
                            const { id = null, name = '', avatar = '' } = player
                            this._isPlayerAuthorized = true
                            this._playerId = id ?? null
                            this._playerName = name

                            if (avatar) {
                                this._playerPhotos.push(avatar)
                            }
                        } else {
                            this._playerApplyGuestData()
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

    showInterstitial(): void {
        (this._platformSdk as GamePushSdk).ads.showFullscreen()
    }

    showRewarded(): void {
        (this._platformSdk as GamePushSdk).ads.showRewardedVideo()
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    showBanner(): void {
        (this._platformSdk as GamePushSdk).ads.showSticky()
    }

    hideBanner(): void {
        (this._platformSdk as GamePushSdk).ads.closeSticky()
    }

    checkAdBlock(): Promise<boolean> {
        return new Promise((resolve) => {
            (this._platformSdk as GamePushSdk).ads.isAdblockEnabled().then((res) => {
                resolve(res)
            })
        })
    }

    #setupRewardedHandlers(): void {
        const sdk = this._platformSdk as GamePushSdk
        sdk.ads.on('rewarded:start', () => {
            this._setRewardedState(REWARDED_STATE.OPENED)
        })

        sdk.ads.on('rewarded:close', (success) => {
            if (!success) {
                this._showAdFailurePopup(true)
            }
        })

        sdk.ads.on('rewarded:reward', () => {
            this._setRewardedState(REWARDED_STATE.REWARDED)
            this._setRewardedState(REWARDED_STATE.CLOSED)
        })
    }

    #setupInterstitialHandlers(): void {
        const sdk = this._platformSdk as GamePushSdk
        sdk.ads.on('fullscreen:start', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        })

        sdk.ads.on('fullscreen:close', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })
    }

    #setupBannerHandlers(): void {
        const sdk = this._platformSdk as GamePushSdk
        sdk.ads.on('sticky:render', () => {
            this._setBannerState(BANNER_STATE.SHOWN)
        })

        sdk.ads.on('sticky:close', () => {
            this._setBannerState(BANNER_STATE.HIDDEN)
        })
    }
}

export default GamePushPlatformBridge
