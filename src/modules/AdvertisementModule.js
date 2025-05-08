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

import EventLite from 'event-lite'
import Timer, { STATE as TIMER_STATE } from '../common/Timer'
import ModuleBase from './ModuleBase'
import {
    BANNER_STATE, EVENT_NAME, INTERSTITIAL_STATE, REWARDED_STATE,
} from '../constants'

class AdvertisementModule extends ModuleBase {
    get isBannerSupported() {
        return this._platformBridge.isBannerSupported
    }

    get bannerState() {
        return this.#bannerState
    }

    get interstitialState() {
        return this.#interstitialState
    }

    get rewardedPlacement() {
        return this.#rewardedPlacement
    }

    get rewardedState() {
        return this.#rewardedState
    }

    get minimumDelayBetweenInterstitial() {
        return this.#minimumDelayBetweenInterstitial
    }

    #bannerState = BANNER_STATE.HIDDEN

    #interstitialState = INTERSTITIAL_STATE.CLOSED

    #interstitialTimer

    #minimumDelayBetweenInterstitial = 60

    #rewardedState = REWARDED_STATE.CLOSED

    #rewardedPlacement = null

    constructor(platformBridge) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.BANNER_STATE_CHANGED,
            (state) => this.#setBannerState(state),
        )

        this._platformBridge.on(
            EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
            (state) => {
                if (state === INTERSTITIAL_STATE.CLOSED) {
                    if (this.#minimumDelayBetweenInterstitial > 0) {
                        this.#startInterstitialTimer()
                    }
                }

                this.#setInterstitialState(state)
            },
        )

        this._platformBridge.on(
            EVENT_NAME.REWARDED_STATE_CHANGED,
            (state) => this.#setRewardedState(state),
        )
    }

    setMinimumDelayBetweenInterstitial(options) {
        const optionsType = typeof options
        let delay = this.#minimumDelayBetweenInterstitial

        switch (optionsType) {
            case 'number': {
                delay = options
                break
            }
            case 'string': {
                delay = parseInt(options, 10)
                if (Number.isNaN(delay)) {
                    return
                }
                break
            }
            default: {
                return
            }
        }

        this.#minimumDelayBetweenInterstitial = delay

        if (this.#interstitialTimer) {
            this.#interstitialTimer.stop()
            this.#startInterstitialTimer()
        }
    }

    showBanner(position, options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                this.showBanner(position, platformDependedOptions)
                return
            }
        }

        if (this.bannerState === BANNER_STATE.LOADING || this.bannerState === BANNER_STATE.SHOWN) {
            return
        }

        this.#setBannerState(BANNER_STATE.LOADING)
        if (!this.isBannerSupported) {
            this.#setBannerState(BANNER_STATE.FAILED)
            return
        }

        this._platformBridge.showBanner(position, options)
    }

    hideBanner() {
        if (this.bannerState === BANNER_STATE.LOADING || this.bannerState === BANNER_STATE.HIDDEN) {
            return
        }

        if (!this.isBannerSupported) {
            return
        }

        this._platformBridge.hideBanner()
    }

    showInterstitial(placement) {
        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#setInterstitialState(INTERSTITIAL_STATE.LOADING)

        if (this.#interstitialTimer && this.#interstitialTimer.state !== TIMER_STATE.COMPLETED) {
            this.#setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }

        this._platformBridge.showInterstitial(placement)
    }

    showRewarded(placement) {
        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#rewardedPlacement = placement
        this.#setRewardedState(REWARDED_STATE.LOADING)
        this._platformBridge.showRewarded(placement)
    }

    checkAdBlock() {
        return this._platformBridge.checkAdBlock()
    }

    #startInterstitialTimer() {
        this.#interstitialTimer = new Timer(this.#minimumDelayBetweenInterstitial)
        this.#interstitialTimer.start()
    }

    #hasAdvertisementInProgress() {
        const isInterstitialInProgress = [
            INTERSTITIAL_STATE.LOADING,
            INTERSTITIAL_STATE.OPENED,
        ].includes(this.#interstitialState)

        const isRewardedInProgress = [
            REWARDED_STATE.LOADING,
            REWARDED_STATE.OPENED,
            REWARDED_STATE.REWARDED,
        ].includes(this.#rewardedState)

        return isInterstitialInProgress || isRewardedInProgress
    }

    #setBannerState(state) {
        if (this.#bannerState === state) {
            return
        }

        this.#bannerState = state
        this.emit(EVENT_NAME.BANNER_STATE_CHANGED, this.#bannerState)
    }

    #setInterstitialState(state) {
        if (this.#interstitialState === state) {
            return
        }

        this.#interstitialState = state
        this.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, this.#interstitialState)
    }

    #setRewardedState(state) {
        if (this.#rewardedState === state) {
            return
        }

        this.#rewardedState = state
        this.emit(EVENT_NAME.REWARDED_STATE_CHANGED, this.#rewardedState)
    }
}

EventLite.mixin(AdvertisementModule.prototype)
export default AdvertisementModule
