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

import Timer, { STATE as TIMER_STATE } from '../common/Timer'
import eventBus, { applyEventBusMixin } from '../common/EventBus'
import ModuleBase from './ModuleBase'
import {
    ADVANCED_BANNERS_ACTION, BANNER_POSITION, BANNER_STATE, DEVICE_ORIENTATION, DEVICE_TYPE,
    EVENT_NAME, INTERSTITIAL_STATE, MODULE_NAME, REWARDED_STATE,
} from '../constants'
import { detectOrientation, findGameCanvas } from '../common/utils'
import analyticsModule from './AnalyticsModule'

const DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL = 60
const DEVICE_TYPES_SET = new Set(Object.values(DEVICE_TYPE))
const ORIENTATIONS_SET = new Set(Object.values(DEVICE_ORIENTATION))

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

    get isAdvancedBannersSupported() {
        const disable = this._platformBridge.options?.advertisement?.advancedBanners?.disable
        if (disable === true) {
            return false
        }

        if (!this._platformBridge.isAdvancedBannersSupported) {
            return false
        }

        const advancedBannersConfig = this._platformBridge.options?.advertisement?.advancedBanners
        if (!advancedBannersConfig) {
            return false
        }

        return Object.keys(advancedBannersConfig).some((key) => key !== 'disable')
    }

    get advancedBannersState() {
        return this.#advancedBannersState
    }

    #bannerState = BANNER_STATE.HIDDEN

    #bannerPosition = null

    #bannerPlacement = null

    #interstitialState = INTERSTITIAL_STATE.CLOSED

    #interstitialPlacement = null

    #interstitialTimer

    #minimumDelayBetweenInterstitial = DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL

    #rewardedState = REWARDED_STATE.CLOSED

    #rewardedPlacement = null

    #advancedBannersState = BANNER_STATE.HIDDEN

    #lastAdvancedBannersMessage = null

    #lastAdvancedBanners = null

    #lastAdvancedBannersKey = null

    #advancedBannersHiddenByAd = false

    constructor(platformBridge) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.BANNER_STATE_CHANGED,
            (state) => this.#setBannerState(state),
        )

        this._platformBridge.on(
            EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
            (state) => {
                this.#setInterstitialState(state)

                if (state === INTERSTITIAL_STATE.LOADING || state === INTERSTITIAL_STATE.OPENED) {
                    this.#hideAdvancedBannersByAd()
                } else if (state === INTERSTITIAL_STATE.CLOSED || state === INTERSTITIAL_STATE.FAILED) {
                    this.#restoreAdvancedBannersAfterAd()
                }

                if (state === INTERSTITIAL_STATE.CLOSED) {
                    this.#startInterstitialTimer()
                }
            },
        )

        this._platformBridge.on(
            EVENT_NAME.REWARDED_STATE_CHANGED,
            (state) => {
                this.#setRewardedState(state)

                if (state === REWARDED_STATE.LOADING || state === REWARDED_STATE.OPENED) {
                    this.#hideAdvancedBannersByAd()
                } else if (state === REWARDED_STATE.CLOSED || state === REWARDED_STATE.FAILED) {
                    this.#restoreAdvancedBannersAfterAd()
                }
            },
        )

        this._platformBridge.on(
            EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED,
            (state) => this.#setAdvancedBannersState(state),
        )

        eventBus.on(
            EVENT_NAME.PLATFORM_MESSAGE_SENT,
            (message) => this.#onPlatformMessageSent(message),
        )

        eventBus.on(
            EVENT_NAME.ORIENTATION_STATE_CHANGED,
            () => this.#onAdvancedBannersConditionsChanged(),
        )

        eventBus.on(
            EVENT_NAME.SCREEN_SIZE_CHANGED,
            () => this.#onAdvancedBannersConditionsChanged(),
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

        const validPosition = Object.values(BANNER_POSITION).includes(position)
            ? position
            : BANNER_POSITION.BOTTOM

        this.#bannerPosition = validPosition

        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            if (this._platformBridge.options?.advertisement?.banner?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.banner.placementFallback
            }
        }
        this.#bannerPlacement = modifiedPlacement

        this.#setBannerState(BANNER_STATE.LOADING)
        if (!this.isBannerSupported) {
            this.#setBannerState(BANNER_STATE.FAILED)
            return
        }

        const placements = this._platformBridge.options?.advertisement?.banner?.placements
        const platformPlacement = this.#getPlatformPlacement(modifiedPlacement, placements)
        this._platformBridge.showBanner(validPosition, platformPlacement)
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

        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            if (this._platformBridge.options?.advertisement?.interstitial?.placementFallback) {
                modifiedPlacement = this._platformBridge.options.advertisement.interstitial.placementFallback
            }
        }
        this.#interstitialPlacement = modifiedPlacement

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

    #setAdvancedBannersState(state) {
        if (this.#advancedBannersState === state) {
            return
        }

        this.#advancedBannersState = state
        analyticsModule.send(`${MODULE_NAME.ADVERTISEMENT}_advanced_banners_${state}`, { placement: this.#lastAdvancedBannersMessage })

        if (state === BANNER_STATE.FAILED) {
            this.#lastAdvancedBanners = null
            this.#lastAdvancedBannersKey = null
            this.#advancedBannersHiddenByAd = false
        }

        eventBus.emit(EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, this.#advancedBannersState)
    }

    #setBannerState(state) {
        if (this.#bannerState === state) {
            return
        }

        this.#bannerState = state
        analyticsModule.send(`${MODULE_NAME.ADVERTISEMENT}_banner_${state}`, { position: this.#bannerPosition, placement: this.#bannerPlacement })

        eventBus.emit(EVENT_NAME.BANNER_STATE_CHANGED, this.#bannerState)
    }

    #setInterstitialState(state) {
        if (this.#interstitialState === state) {
            return
        }

        this.#interstitialState = state
        analyticsModule.send(`${MODULE_NAME.ADVERTISEMENT}_interstitial_${state}`, { placement: this.#interstitialPlacement })

        eventBus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, this.#interstitialState)
    }

    #setRewardedState(state) {
        if (this.#rewardedState === state) {
            return
        }

        this.#rewardedState = state
        analyticsModule.send(`${MODULE_NAME.ADVERTISEMENT}_rewarded_${state}`, { placement: this.#rewardedPlacement })

        eventBus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, this.#rewardedState)
    }

    #onPlatformMessageSent(message) {
        if (!this.isAdvancedBannersSupported) {
            return
        }

        const advancedBannersConfig = this._platformBridge.options?.advertisement?.advancedBanners
        const messageConfig = advancedBannersConfig?.[message]
        if (!messageConfig) {
            return
        }

        const action = messageConfig.action ?? ADVANCED_BANNERS_ACTION.SHOW

        if (action === ADVANCED_BANNERS_ACTION.HIDE) {
            const needsHide = this.#lastAdvancedBanners && !this.#advancedBannersHiddenByAd
            this.#lastAdvancedBannersMessage = null
            this.#lastAdvancedBanners = null
            this.#lastAdvancedBannersKey = null
            this.#advancedBannersHiddenByAd = false
            if (needsHide) {
                this._platformBridge.hideAdvancedBanners()
            }
            return
        }

        const { key, banners } = this.#resolveAdvancedBanners(messageConfig)

        this.#lastAdvancedBannersMessage = message
        this.#lastAdvancedBannersKey = key

        if (this.#lastAdvancedBanners && !banners) {
            this._platformBridge.hideAdvancedBanners()
        }

        this.#lastAdvancedBanners = banners

        if (!banners) {
            return
        }

        if (this.#hasAdvertisementInProgress()) {
            this.#advancedBannersHiddenByAd = true
            return
        }

        this._platformBridge.showAdvancedBanners(banners)
    }

    #onAdvancedBannersConditionsChanged() {
        if (!this.#lastAdvancedBannersMessage) {
            return
        }

        const advancedBannersConfig = this._platformBridge.options?.advertisement?.advancedBanners
        const messageConfig = advancedBannersConfig?.[this.#lastAdvancedBannersMessage]
        if (!messageConfig) {
            return
        }

        const { key, banners } = this.#resolveAdvancedBanners(messageConfig)

        if (key === this.#lastAdvancedBannersKey) {
            return
        }

        this.#lastAdvancedBannersKey = key
        this.#lastAdvancedBanners = banners

        if (this.#advancedBannersHiddenByAd) {
            return
        }

        this._platformBridge.hideAdvancedBanners()

        if (banners) {
            this._platformBridge.showAdvancedBanners(banners)
        }
    }

    #hideAdvancedBannersByAd() {
        if (!this.#lastAdvancedBanners || this.#advancedBannersHiddenByAd) {
            return
        }

        this.#advancedBannersHiddenByAd = true
        this._platformBridge.hideAdvancedBanners()
    }

    #restoreAdvancedBannersAfterAd() {
        if (!this.#advancedBannersHiddenByAd) {
            return
        }

        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#advancedBannersHiddenByAd = false

        if (this.#lastAdvancedBanners) {
            this._platformBridge.showAdvancedBanners(this.#lastAdvancedBanners)
        }
    }

    #resolveAdvancedBanners(messageConfig) {
        const { deviceType } = this._platformBridge
        const orientation = detectOrientation()
        const canvas = findGameCanvas()

        const context = {
            deviceType, orientation, canvas,
        }

        let bestKey = 'default'
        let bestBanners = messageConfig.default ?? null
        let bestScore = -1

        Object.keys(messageConfig)
            .filter((key) => key !== 'action' && key !== 'default')
            .forEach((key) => {
                const result = this.#matchAdvancedBannerKey(key, context)

                if (result.matched && result.score > bestScore) {
                    bestScore = result.score
                    bestKey = key
                    bestBanners = messageConfig[key]
                }
            })

        return { key: bestKey, banners: bestBanners }
    }

    #matchAdvancedBannerKey(key, context) {
        const { deviceType, orientation, canvas } = context
        const segments = key.split(':')
        const useCanvas = segments.includes('canvas')
        let score = 0

        if (useCanvas && !canvas) {
            return { matched: false, score }
        }

        if (useCanvas) {
            score += 1
        }

        const matched = segments.every((segment) => {
            if (segment === 'canvas') {
                return true
            }

            if (DEVICE_TYPES_SET.has(segment)) {
                if (segment !== deviceType) {
                    return false
                }
                score += 4
            } else if (ORIENTATIONS_SET.has(segment)) {
                if (segment !== orientation) {
                    return false
                }
                score += 2
            } else {
                const conditionMatch = /^([wh])([><]=?)(\d+)$/.exec(segment)
                if (!conditionMatch) {
                    return false
                }

                const screenWidth = useCanvas ? canvas.width : window.innerWidth
                const screenHeight = useCanvas ? canvas.height : window.innerHeight
                const dimension = conditionMatch[1] === 'w' ? screenWidth : screenHeight
                const operator = conditionMatch[2]
                const value = parseInt(conditionMatch[3], 10)

                if (!this.#evaluateScreenCondition(dimension, operator, value)) {
                    return false
                }
                score += 1
            }

            return true
        })

        return { matched, score }
    }

    #evaluateScreenCondition(dimension, operator, value) {
        switch (operator) {
            case '>': return dimension > value
            case '<': return dimension < value
            case '>=': return dimension >= value
            case '<=': return dimension <= value
            default: return false
        }
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

applyEventBusMixin(AdvertisementModule.prototype)
export default AdvertisementModule
