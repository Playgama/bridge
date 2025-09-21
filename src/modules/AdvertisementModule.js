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
    BANNER_POSITION, BANNER_STATE, EVENT_NAME, INTERSTITIAL_STATE, REWARDED_STATE,
} from '../constants'

const DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL = 60

class AdvertisementModule extends ModuleBase {
    get isBannerSupported() {
        const disable = this._platformBridge.options?.advertisement?.banner?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isBannerSupported
    }

    get bannerState() {
        return this.#bannerState
    }

    get isInterstitialSupported() {
        const disable = this._platformBridge.options?.advertisement?.interstitial?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isInterstitialSupported
    }

    get interstitialState() {
        return this.#interstitialState
    }

    get isRewardedSupported() {
        const disable = this._platformBridge.options?.advertisement?.rewarded?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isRewardedSupported
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

    #minimumDelayBetweenInterstitial = DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL

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
                    this.#startInterstitialTimer()
                }

                this.#setInterstitialState(state)
            },
        )

        this._platformBridge.on(
            EVENT_NAME.REWARDED_STATE_CHANGED,
            (state) => this.#setRewardedState(state),
        )

        this.#applyConfigMinimumDelayBetweenInterstitial()
    }

    setMinimumDelayBetweenInterstitial(value) {
        const configDelay = this.#normalizeMinimumDelayBetweenInterstitial(
            this.#getConfigMinimumDelayBetweenInterstitial(),
        )
        if (configDelay !== null) {
            return
        }

        const delay = this.#normalizeMinimumDelayBetweenInterstitial(value)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelayBetweenInterstitial(delay)
    }

    showBanner(position = BANNER_POSITION.BOTTOM, placement = null) {
        if (this.bannerState === BANNER_STATE.LOADING || this.bannerState === BANNER_STATE.SHOWN) {
            return
        }

        this.#setBannerState(BANNER_STATE.LOADING)
        if (!this.isBannerSupported) {
            this.#setBannerState(BANNER_STATE.FAILED)
            return
        }

        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            if (this._platformBridge.options?.advertisement?.banner?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.banner.placementFallback
            }
        }

        const placements = this._platformBridge.options?.advertisement?.banner?.placements
        const platformPlacement = this.#getPlatformPlacement(modifiedPlacement, placements)
        this._platformBridge.showBanner(position, platformPlacement)
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

    preloadInterstitial(placement = null) {
        if (!this.isInterstitialSupported) {
            return
        }
        let modifiedPlacement = placement
        if (!modifiedPlacement || typeof modifiedPlacement !== 'string') {
            if (this._platformBridge.options?.advertisement?.interstitial?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.interstitial.placementFallback
            }
        }

        const placements = this._platformBridge.options?.advertisement?.interstitial?.placements
        const platformPlacement = this.#getPlatformPlacement(modifiedPlacement, placements)
        this._platformBridge.preloadInterstitial(platformPlacement)
    }

    showInterstitial(placement = null) {
        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#setInterstitialState(INTERSTITIAL_STATE.LOADING)

        if (!this.isInterstitialSupported) {
            this.#setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }

        if (this._platformBridge.isMinimumDelayBetweenInterstitialEnabled) {
            if (this.#interstitialTimer && this.#interstitialTimer.state === TIMER_STATE.STARTED) {
                this.#setInterstitialState(INTERSTITIAL_STATE.FAILED)
                return
            }
        }

        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            if (this._platformBridge.options?.advertisement?.interstitial?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.interstitial.placementFallback
            }
        }

        const placements = this._platformBridge.options?.advertisement?.interstitial?.placements
        const platformPlacement = this.#getPlatformPlacement(modifiedPlacement, placements)
        this._platformBridge.showInterstitial(platformPlacement)
    }

    preloadRewarded(placement = null) {
        if (!this.isRewardedSupported) {
            return
        }
        let modifiedPlacement = placement
        if (!modifiedPlacement || typeof modifiedPlacement !== 'string') {
            if (this._platformBridge.options?.advertisement?.rewarded?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.rewarded.placementFallback
            }
        }

        const placements = this._platformBridge.options?.advertisement?.rewarded?.placements
        const platformPlacement = this.#getPlatformPlacement(modifiedPlacement, placements)
        this._platformBridge.preloadRewarded(platformPlacement)
    }

    showRewarded(placement = null) {
        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#rewardedPlacement = placement
        if (!this.#rewardedPlacement) {
            if (this._platformBridge.options?.advertisement?.rewarded?.placementFallback) {
                this.#rewardedPlacement = this._platformBridge.options.advertisement.rewarded.placementFallback
            }
        }

        const placements = this._platformBridge.options?.advertisement?.rewarded?.placements
        const platformPlacement = this.#getPlatformPlacement(this.#rewardedPlacement, placements)

        this.#setRewardedState(REWARDED_STATE.LOADING)
        if (!this.isRewardedSupported) {
            this.#setRewardedState(REWARDED_STATE.FAILED)
            return
        }
        this._platformBridge.showRewarded(platformPlacement)
    }

    checkAdBlock() {
        return this._platformBridge.checkAdBlock()
    }

    #applyMinimumDelayBetweenInterstitial(delay) {
        this.#minimumDelayBetweenInterstitial = delay

        if (this.#interstitialTimer) {
            this.#interstitialTimer.stop()
            this.#startInterstitialTimer()
        }
    }

    #normalizeMinimumDelayBetweenInterstitial(value) {
        if (typeof value === 'number') {
            return value
        }

        if (typeof value === 'string') {
            const delay = parseInt(value, 10)
            if (Number.isNaN(delay)) {
                return null
            }

            return delay
        }

        return null
    }

    #applyConfigMinimumDelayBetweenInterstitial() {
        const configDelay = this.#getConfigMinimumDelayBetweenInterstitial()
        if (configDelay === undefined) {
            return
        }

        const delay = this.#normalizeMinimumDelayBetweenInterstitial(configDelay)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelayBetweenInterstitial(delay)
    }

    #getConfigMinimumDelayBetweenInterstitial() {
        return this._platformBridge.options?.advertisement?.minimumDelayBetweenInterstitial
    }

    #startInterstitialTimer() {
        if (
            this.#minimumDelayBetweenInterstitial > 0
            && this._platformBridge.isMinimumDelayBetweenInterstitialEnabled
        ) {
            this.#interstitialTimer = new Timer(this.#minimumDelayBetweenInterstitial)
            this.#interstitialTimer.start()
        }
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

    #getPlatformPlacement(id, placements) {
        if (!id) {
            return id
        }

        if (!placements) {
            return id
        }

        const placement = placements.find((p) => p.id === id)
        if (!placement) {
            return id
        }

        if (placement[this._platformBridge.platformId]) {
            return placement[this._platformBridge.platformId]
        }

        return id
    }
}

EventLite.mixin(AdvertisementModule.prototype)
export default AdvertisementModule
