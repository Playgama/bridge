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
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
    BANNER_STATE,
    BANNER_CONTAINER_ID,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'
import { addAdsByGoogle, createAdvertisementBannerContainer } from '../common/utils'

class XiaomiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.XIAOMI
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
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
                || !this._options.adSenseId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.XIAOMI_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addAdsByGoogle({
                    adSenseId: this._options.adSenseId,
                }).then((showAd) => {
                    this._showAd = showAd
                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                }).catch((error) => {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.INITIALIZE,
                        error,
                    )
                })
            }
        }

        return promiseDecorator.promise
    }

    // advertisement
    showBanner(position, placement) {
        if (this._bannerContainer) {
            return
        }

        this._bannerPlacement = placement
        this._bannerContainer = createAdvertisementBannerContainer(position)

        const ins = this.#createIns(placement)
        this._bannerContainer.appendChild(ins)
    }

    hideBanner() {
        this._bannerContainer?.remove()
        this._bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial(placement) {
        if (!this._showAd) {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }

        this._showAd({
            type: 'start',
            name: placement,
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if (this.interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                }
            },
        })
    }

    showRewarded(placement) {
        if (!this._showAd) {
            this._setRewardedState(REWARDED_STATE.FAILED)
            return
        }

        this._showAd({
            type: 'reward',
            name: placement,
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if (this.rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn) => { showAdFn(0) },
            adDismissed: () => { },
            adViewed: () => { this._setRewardedState(REWARDED_STATE.REWARDED) },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus === 'frequencyCapped' || placementInfo.breakStatus === 'other') {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                }
            },
        })
    }

    #createIns(placementId) {
        const ins = document.createinsement('ins')
        ins.setAttribute('data-ad-client', this._options.adSenseId)
        ins.setAttribute('data-ad-slot-key', placementId)
        ins.setAttribute('data-ad-format', 'auto')
        ins.setAttribute('data-container-id', BANNER_CONTAINER_ID)

        return ins
    }
}

export default XiaomiPlatformBridge
