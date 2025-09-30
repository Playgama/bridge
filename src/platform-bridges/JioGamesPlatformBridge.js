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
import {
    addJavaScript,
} from '../common/utils'

import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    LEADERBOARD_TYPE,
    BANNER_STATE,
} from '../constants'

const SDK_URL = 'https://jiogames.akamaized.net/gameSDK/jiogames/stable/v2.0/jiogames_sdk.js'
class JioGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.JIO_GAMES
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    get isBannerSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    _preloadInterstitialPromise = null

    _preloadRewardedPromise = null

    _isBannerAvailable = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            window.onSdkReady = () => {
                this._platformSdk = window.JioGames

                if (this._platformSdk.playerInfo) {
                    const {
                        gamer_id: id, gamer_name: name, gamer_avatar_url: photo, ...extra
                    } = this._platformSdk.playerInfo

                    this.playerId = id || null
                    this.playerName = name || null
                    if (photo) {
                        this.playerPhotos.push(photo)
                    }
                    this.playerExtra = extra

                    this._isPlayerAuthorized = true
                }

                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            }

            window.onBannerReady = () => {
                this._isBannerAvailable = true
            }

            addJavaScript(SDK_URL, this._options.adTestMode ? { 'data-jg-test-environment': 'on' } : {})
                .catch((error) => {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.INITIALIZE,
                        JSON.stringify(error),
                    )
                })
        }

        return promiseDecorator.promise
    }

    // advertisement
    preloadInterstitial() {
        this.#preloadInterstitial()
    }

    showInterstitial() {
        this.#preloadInterstitial().then(() => {
            this._platformSdk.showAd(window.AdType?.Interstitial, {
                onAdClosed: () => {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                },
                onAdFailedToLoad: (error) => {
                    console.error(error)
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                },
            })
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            this._preloadInterstitialPromise = null
        })
    }

    preloadRewarded() {
        this.#preloadRewarded()
    }

    showRewarded() {
        this.#preloadRewarded().then(() => {
            this._platformSdk.showAd(window.AdType?.Rewarded, {
                onAdClosed: (isRewardUser) => {
                    if (isRewardUser) {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    }

                    this._setRewardedState(REWARDED_STATE.CLOSED)
                },
                onAdFailedToLoad: (error) => {
                    console.error(error)
                    this._setRewardedState(REWARDED_STATE.FAILED)
                },
            })
            this._setRewardedState(REWARDED_STATE.OPENED)
            this._preloadRewardedPromise = null
        })
    }

    showBanner(position) {
        if (!this._isBannerAvailable) {
            this._setBannerState(BANNER_STATE.FAILED)
            return
        }

        window.JGBanner?.loadBanner()
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
                window.JGBanner?.showBanner(position || window.BannerPosition?.TOP)
            })
            .catch((error) => {
                console.error(error)
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        window.JGBanner?.hideBanner()

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    // leaderboards
    leaderboardsSetScore(_, score, isMain) {
        if (!isMain) {
            return Promise.reject()
        }

        const value = typeof score === 'string'
            ? parseInt(score, 10)
            : score

        this._platformSdk.postScore(value)

        return Promise.resolve()
    }

    #preloadInterstitial() {
        const self = this
        if (this._preloadInterstitialPromise) {
            return this._preloadInterstitialPromise
        }

        this._preloadInterstitialPromise = new Promise((resolve, reject) => {
            this._platformSdk.cacheAd(window?.AdType.Interstitial || 'Interstitial', {
                onAdPrepared: resolve,
                onAdFailedToLoad: (error) => {
                    self._preloadInterstitialPromise = null
                    reject(new Error(error))
                },
            })
        })

        return this._preloadInterstitialPromise
    }

    #preloadRewarded() {
        const self = this
        if (this._preloadRewardedPromise) {
            return this._preloadRewardedPromise
        }

        this._preloadRewardedPromise = new Promise((resolve, reject) => {
            this._platformSdk.cacheAd(window?.AdType.Rewarded || 'Rewarded', {
                onAdPrepared: resolve,
                onAdFailedToLoad: (error) => {
                    self._preloadRewardedPromise = null
                    reject(new Error(error))
                },
            })
        })

        return this._preloadRewardedPromise
    }
}

export default JioGamesPlatformBridge
