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
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    ERROR,
} from '../constants'

const SDK_URL = '/jiogames_stb_sdk_v1.0.js'

class JioGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.JIO_GAMES
    }

    _packageName = null

    _interstitialPlacement = null

    _rewardedPlacement = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.packageName
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.JIO_GAMES_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addJavaScript(SDK_URL).then(() => {
                    waitFor('DroidHandler').then(() => {
                        this._packageName = this._options.packageName

                        this._platformSdk = window.DroidHandler
                        this._isInitialized = true

                        this.#setupAdHandlers()

                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    preloadInterstitial(placement) {
        this.#preloadInterstitial(placement)
    }

    _resolveInterstitialPreload = null

    _rejectInterstitialPreload = null

    _preloadInterstitialPromise = null

    // advertisement
    #preloadInterstitial(placement, forciblyPreload = false) {
        if (!this._interstitialPlacement || forciblyPreload) {
            this._interstitialPlacement = placement
        }

        if (!this._preloadInterstitialPromise) {
            this._platformSdk.cacheAd(placement, this._packageName)

            this._preloadInterstitialPromise = new Promise((resolve, reject) => {
                this._resolveInterstitialPreload = resolve
                this._rejectInterstitialPreload = reject
            })
        }

        return this._preloadInterstitialPromise
    }

    showInterstitial(placement) {
        this.#preloadInterstitial(placement)
            .then(() => {
                this._platformSdk.showAd(placement, this._packageName)
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            })
            .catch((error) => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED, error)
            })
            .finally(() => {
                this.#preloadInterstitial(placement, true)
            })
    }

    _resolveRewardedPreload = null

    _rejectRewardedPreload = null

    _preloadRewardedPromise = null

    _shouldRewardUser = false

    // advertisement
    #preloadRewarded(placement, forciblyPreload = false) {
        if (!this.rewardedPlacement || forciblyPreload) {
            this.rewardedPlacement = placement
        }

        if (!this._preloadRewardedPromise) {
            this._platformSdk.cacheAd(placement, this._packageName)

            this._preloadRewardedPromise = new Promise((resolve, reject) => {
                this._resolveRewardedPreload = resolve
                this._rejectRewardedPreload = reject
            })

            this.#setupAdHandlers()
        }

        return this._preloadRewardedPromise
    }

    preloadRewarded(placement) {
        this.#preloadRewarded(placement)
    }

    showRewarded(placement) {
        this.#preloadRewarded(placement)
            .then(() => {
                this._platformSdk.showAd(placement, this._packageName)
                this._setRewardedState(REWARDED_STATE.OPENED)
            })
            .catch((error) => {
                this._setRewardedState(REWARDED_STATE.FAILED, error)
            })
            .finally(() => {
                this.#preloadRewarded(placement, true)
            })
    }

    #setupAdHandlers() {
        window.onAdReady = (placement) => {
            if (placement === this._interstitialPlacement) {
                this._resolveInterstitialPreload()
                this._resolveInterstitialPreload = null
            }

            // placement == adSpotRewardedVideo && (isRVReady = true, console.log("JioGames: onAdReady RewardedVideo " + isRVReady));
        }

        window.onAdClose = (placement) => {
            if (placement === this._rewardedPlacement && this._shouldRewardUser) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._shouldRewardUser = false
            }
        };

        window.onAdError = (placement, errorMessage) => {
            if (placement === this._interstitialPlacement) {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED, errorMessage)
            }

            if (placement === this._rewardedPlacement) {
                this._setRewardedState(REWARDED_STATE.FAILED, errorMessage)
            }
        }

        window.onAdMediaEnd = (placement /* , success, value */) => {
            if (placement === this._rewardedPlacement) {
                this._shouldRewardUser = true // success
            }
        }

        window.onAdPrepared = () => {}

        window.onAdClosed = (...args) => {
            const localData = args[0]?.split(',')
            let placement = args[0]
            let isVideoCompleted = args[1]
            let isEligibleForReward = args[2]

            if (localData?.length > 1) {
                placement = localData[0].trim()
                isVideoCompleted = Boolean(localData[1].trim())
                isEligibleForReward = Boolean(localData[2].trim())
            }

            if (placement === this._rewardedPlacement && isVideoCompleted && isEligibleForReward) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            }
        }

        window.onAdFailedToLoad = (...args) => {
            const localData = args[0]?.split(',')
            let placement = args[0]
            let description = args[1]

            if (localData !== null && localData.length > 1) {
                placement = localData[0].trim()
                description = localData[1].trim()
            }

            if (placement === this._interstitialPlacement) {
                this._rejectInterstitialPreload(description)
            }

            if (placement === this._rewardedPlacement) {
                this._rejectRewardedPreload(description)
            }
        }

        window.onAdClick = () => { }
        window.onAdMediaCollapse = () => { }
        window.onAdMediaExpand = () => { }
        window.onAdMediaStart = () => { }
        window.onAdRefresh = () => { }
        window.onAdRender = () => { }
        window.onAdSkippable = () => { }
        window.onAdView = () => { }
    }
}

export default JioGamesPlatformBridge
