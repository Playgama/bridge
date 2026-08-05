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
import { addJavaScript } from '../utils'
import { ACTION_NAME, ERROR } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../modules/advertisement/constants'

const SDK_URL = 'https://api.gamemonetize.com/sdk.js'

// Small delay after AD_SDK_MANAGER_READY before showing the launch interstitial,
// so the game has time to finish initializing before the ad is requested.
const INITIAL_INTERSTITIAL_DELAY = 500

// If the SDK never reports AD_SDK_MANAGER_READY (blocked ad manager, adblock, slow network),
// the launch interstitial is requested anyway this long after SDK_READY.
const INITIAL_INTERSTITIAL_FALLBACK_DELAY = 5000

interface GmSdkEvent {
    name: string
}

interface GmSdk {
    showBanner?: () => void
}

declare global {
    interface Window {
        SDK_OPTIONS?: {
            gameId: string
            onEvent(event: GmSdkEvent): void
        }
        sdk?: GmSdk
    }
}

class GameMonetizePlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.GAME_MONETIZE
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    get isMinimumDelayBetweenInterstitialEnabled(): boolean {
        return false
    }

    #currentAdvertisementIsRewarded = false

    // Whether the currently playing rewarded ad has been watched to completion.
    // The reward is granted only if the ad fires COMPLETE before the game resumes.
    #rewardedAdCompleted = false

    // The launch interstitial must be shown exactly once, whichever trigger fires first.
    #launchInterstitialRequested = false

    #launchInterstitialTimeoutId: ReturnType<typeof setTimeout> | null = null

    #adManagerReady = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options || typeof this._options.gameId !== 'string') {
                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
            } else {
                const self = this
                window.SDK_OPTIONS = {
                    gameId: this._options.gameId,
                    onEvent(event: GmSdkEvent) {
                        switch (event.name) {
                            case 'SDK_READY': {
                                self._platformSdk = window.sdk as GmSdk
                                self._isInitialized = true

                                // AD_SDK_MANAGER_READY may arrive before or after SDK_READY, and on some
                                // setups never at all — in that case the launch ad is shown anyway.
                                self.#scheduleLaunchInterstitial(
                                    self.#adManagerReady
                                        ? INITIAL_INTERSTITIAL_DELAY
                                        : INITIAL_INTERSTITIAL_FALLBACK_DELAY,
                                    true,
                                )

                                self._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                break
                            }
                            case 'AD_SDK_MANAGER_READY':
                                // Show the launch interstitial after the ad manager is ready, with a
                                // small delay so the game has time to finish initializing.
                                self.#adManagerReady = true
                                if (self._isInitialized) {
                                    self.#scheduleLaunchInterstitial(INITIAL_INTERSTITIAL_DELAY, true)
                                }
                                break
                            case 'SDK_GAME_PAUSE':
                                if (self.#currentAdvertisementIsRewarded) {
                                    self._setRewardedState(REWARDED_STATE.OPENED)
                                } else {
                                    self._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                }
                                break
                            case 'COMPLETE':
                                // The ad was watched to the end. Remember it so the reward
                                // can be granted once the game resumes (SDK_GAME_START).
                                if (self.#currentAdvertisementIsRewarded) {
                                    self.#rewardedAdCompleted = true
                                }
                                break
                            case 'SDK_GAME_START':
                                if (self.#currentAdvertisementIsRewarded) {
                                    // Grant the reward only if the ad actually played to completion.
                                    // Skipped or interrupted ads must not be rewarded.
                                    if (self.#rewardedAdCompleted) {
                                        self._setRewardedState(REWARDED_STATE.REWARDED)
                                    }
                                    self._setRewardedState(REWARDED_STATE.CLOSED)
                                } else {
                                    self._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                }
                                self.#rewardedAdCompleted = false
                                break
                            case 'SDK_ERROR':
                            case 'AD_ERROR':
                                if (self.#currentAdvertisementIsRewarded) {
                                    self._setRewardedState(REWARDED_STATE.FAILED)
                                } else {
                                    self._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                                }
                                self.#rewardedAdCompleted = false
                                break
                            default:
                                break
                        }
                    },
                }

                this._setPlatformStorageAvailable(false)
                addJavaScript(SDK_URL)
            }
        }

        return promiseDecorator.promise
    }

    // advertisement
    showInterstitial(): void {
        this.#currentAdvertisementIsRewarded = false
        this.#showAd(false)
    }

    showRewarded(): void {
        this.#currentAdvertisementIsRewarded = true
        this.#rewardedAdCompleted = false
        this.#showAd(true)
    }

    // private methods
    #scheduleLaunchInterstitial(delay: number, force = false): void {
        if (this.#launchInterstitialRequested) {
            return
        }

        if (this.#launchInterstitialTimeoutId !== null) {
            if (!force) {
                return
            }

            clearTimeout(this.#launchInterstitialTimeoutId)
        }

        this.#launchInterstitialTimeoutId = setTimeout(() => {
            this.#launchInterstitialTimeoutId = null
            this.#launchInterstitialRequested = true
            this.showInterstitial()
        }, delay)
    }

    #showAd(isRewarded: boolean): void {
        const sdk = this._platformSdk as GmSdk | null
        if (sdk && typeof sdk.showBanner === 'function') {
            sdk.showBanner()
        } else {
            this._showAdFailurePopup(isRewarded)
        }
    }
}

export default GameMonetizePlatformBridge
