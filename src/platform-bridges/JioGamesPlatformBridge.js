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
    createAdContainer,
    createAdvertisementBannerContainer,
    waitFor,
} from '../common/utils'

import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    ERROR,
    LEADERBOARD_TYPE,
    BANNER_CONTAINER_ID,
    BANNER_STATE,
    REWARDED_CONTAINER_ID,
    INTERSTITIAL_CONTAINER_ID,
} from '../constants'

const SDK_URL = 'https://jioadsweb.akamaized.net/jioads/websdk/default/stable/v2/jioAds.js'

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

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    #packageName = null

    #bannerPlacement = null

    #bannerContainer = null

    #interstitialPlacement = null

    #interstitialContainer = null

    #rewardedPlacement = null

    #rewardedContainer = null

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
                    waitFor('JioAds').then(() => {
                        const self = this

                        this.#packageName = this._options.packageName

                        this._platformSdk = window.JioAds

                        if (window.DroidHandler) {
                            window.DroidHandler.getUserProfile()
                            window.DroidHandler.postMessage(JSON.stringify({ key: 'getUserProperties' }))
                        } else {
                            window.onUserPropertiesResponse({ detail: { uid: '', ifa: '' } })
                        }

                        window.onUserProfileResponse = (message) => {
                            const obj = JSON.parse(message)

                            self.playerId = obj.gamer_id || null
                            self.playerName = obj.gamer_name || null

                            if (obj.gamer_avatar_url) {
                                self.playerPhotos.push(obj.gamer_avatar_url)
                            }

                            self._isPlayerAuthorized = true
                        }

                        window.onUserPropertiesResponse = (obj) => {
                            self.#setupAdvertisement(obj)
                        }

                        this._platformSdk.onInitialised = () => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        }
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    // advertisement
    showBanner(position, placement) {
        if (this.#bannerContainer) {
            return
        }

        this.#bannerPlacement = placement
        this.#bannerContainer = createAdvertisementBannerContainer(position)

        const ins = this.#createIns(placement, { 'data-container-id': BANNER_CONTAINER_ID })
        this.#bannerContainer.appendChild(ins)
    }

    hideBanner() {
        this.#bannerContainer?.remove()
        this.#bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial(placement) {
        if (this.#interstitialContainer) {
            return
        }

        this.#interstitialPlacement = placement
        this.#interstitialContainer = createAdContainer(INTERSTITIAL_CONTAINER_ID)

        const ins = this.#createIns(placement, { 'data-container-id': INTERSTITIAL_CONTAINER_ID })
        this.#interstitialContainer.appendChild(ins)
    }

    showRewarded(placement) {
        if (this.#rewardedContainer) {
            return
        }

        this.#rewardedPlacement = placement
        this.#rewardedContainer = createAdContainer(REWARDED_CONTAINER_ID)

        const ins = this.#createIns(placement, { 'data-container-id': REWARDED_CONTAINER_ID })
        this.#rewardedContainer.appendChild(ins)
    }

    // leaderboards
    leaderboardsSetScore(id, score, isMain) {
        if (!isMain || !window.DroidHandler) {
            return Promise.reject()
        }

        const value = typeof score === 'string'
            ? parseInt(score, 10)
            : score

        window.DroidHandler.postScore(value)
        return Promise.resolve()
    }

    #createIns(placementId, extraAttrs = {}) {
        const ins = document.createElement('ins')
        ins.setAttribute('data-adspot-key', placementId)
        ins.setAttribute('data-source', this.#packageName)
        Object.entries(extraAttrs).forEach(([k, v]) => ins.setAttribute(k, String(v)))

        return ins
    }

    #setupAdvertisement(obj) {
        this._platformSdk.setConfiguration({
            ...obj,
            reqType: 'prod',
            logLevel: 1,
            adRequestTimeout: 6000,
            adRenderingTimeout: 5000,
        })
  
        this._platformSdk.onAdPrepared = (placement) => {
            if (placement === this.#bannerPlacement) {
                this._setBannerState(BANNER_STATE.SHOWN)
            } else if (placement === this.#interstitialPlacement) {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            } else if (placement === this.#rewardedPlacement) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            }
        }

        this._platformSdk.onAdFailedToLoad = (placement, options) => {
            console.error(JSON.stringify(options))

            if (placement === this.#bannerPlacement) {
                this.#bannerContainer?.remove()
                this.#bannerContainer = null

                this._setBannerState(BANNER_STATE.FAILED)
            } else if (placement === this.#interstitialPlacement) {
                this.#interstitialContainer?.remove()
                this.#interstitialContainer = null

                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else if (placement === this.#rewardedPlacement) {
                this.#rewardedContainer?.remove()
                this.#rewardedContainer = null

                this._setRewardedState(REWARDED_STATE.FAILED)
            }
        }

        this._platformSdk.onAdClosed = (placement, isVideoCompleted, reward) => {
            if (placement === this.#interstitialPlacement) {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)

                this.#interstitialContainer?.remove()
                this.#interstitialContainer = null
            } else if (placement === this.#rewardedPlacement) {
                if (reward && isVideoCompleted) {
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                }

                this._setRewardedState(REWARDED_STATE.CLOSED)

                this.#rewardedContainer?.remove()
                this.#rewardedContainer = null
            }
        }
    }
}

export default JioGamesPlatformBridge
