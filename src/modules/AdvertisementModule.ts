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
import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import {
    ADVANCED_BANNERS_ACTION, BANNER_POSITION, BANNER_STATE,
    DEVICE_ORIENTATION, DEVICE_TYPE, EVENT_NAME, INTERSTITIAL_STATE, MODULE_NAME,
    PLATFORM_MESSAGE, REWARDED_STATE,
    type BannerState,
    type BannerPosition,
    type InterstitialState,
    type RewardedState,
    type DeviceType,
    type DeviceOrientation,
    type PlatformId,
} from '../constants'
import { detectOrientation, findGameCanvas } from '../common/utils'
import analyticsModule from './AnalyticsModule'
import type { AnyRecord, EventEmitter } from '../types/common'

const DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL = 60
const ADVANCED_BANNERS_CONDITIONS_DEBOUNCE = 200
const ADVANCED_BANNERS_SCORE = {
    DEVICE_TYPE: 4,
    ORIENTATION: 2,
    DIMENSION: 1,
    CANVAS: 1,
}
const DEVICE_TYPES_SET = new Set<string>(Object.values(DEVICE_TYPE))
const ORIENTATIONS_SET = new Set<string>(Object.values(DEVICE_ORIENTATION))

interface AnalyticsModuleLike {
    send(eventType: string, data?: Record<string, unknown>): void
}

interface PlacementMapping {
    id: string
    [platform: string]: string
}

interface AdvancedBannersPlacementConfig {
    action?: string
    default?: unknown
    [key: string]: unknown
}

interface AdvertisementOptions {
    banner?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
    }
    interstitial?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
    }
    rewarded?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
    }
    advancedBanners?: {
        disable?: boolean
        placementFallback?: string
        [placement: string]: AdvancedBannersPlacementConfig | boolean | string | undefined
    }
    minimumDelayBetweenInterstitial?: number | string
    initialInterstitialDelay?: number | string
}

export interface AdvertisementBridgeOptions {
    advertisement?: AdvertisementOptions
    [key: string]: unknown
}

export interface AdvertisementBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options: AdvertisementBridgeOptions
    isBannerSupported: boolean
    isAdvancedBannersSupported: boolean
    isInterstitialSupported: boolean
    isRewardedSupported: boolean
    isMinimumDelayBetweenInterstitialEnabled: boolean
    initialInterstitialDelay: number
    deviceType: DeviceType
    showBanner(position: BannerPosition, placement?: string | null): void
    hideBanner(): void
    preloadInterstitial(placement?: string | null): void
    showInterstitial(placement?: string | null): void
    preloadRewarded(placement?: string | null): void
    showRewarded(placement?: string | null): void
    showAdvancedBanners(config: unknown): void
    hideAdvancedBanners(): void
    checkAdBlock(): Promise<unknown>
}

interface AdvancedBannerMatchContext {
    deviceType: DeviceType
    orientation: DeviceOrientation
    canvas: HTMLCanvasElement | null
}

interface AdvertisementModule extends EventEmitter {}

class AdvertisementModule extends ModuleBase<AdvertisementBridgeContract> {
    get isBannerSupported(): boolean {
        const disable = this._platformBridge.options?.advertisement?.banner?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isBannerSupported
    }

    get bannerState(): BannerState {
        return this.#bannerState
    }

    get isInterstitialSupported(): boolean {
        const disable = this._platformBridge.options?.advertisement?.interstitial?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isInterstitialSupported
    }

    get interstitialState(): InterstitialState {
        return this.#interstitialState
    }

    get isRewardedSupported(): boolean {
        const disable = this._platformBridge.options?.advertisement?.rewarded?.disable
        if (disable === true) {
            return false
        }

        return this._platformBridge.isRewardedSupported
    }

    get rewardedPlacement(): string | null {
        return this.#rewardedPlacement
    }

    get rewardedState(): RewardedState {
        return this.#rewardedState
    }

    get minimumDelayBetweenInterstitial(): number {
        return this.#minimumDelayBetweenInterstitial
    }

    get isAdvancedBannersSupported(): boolean {
        if ((this.#advancedBannersOptions as AnyRecord | undefined)?.disable === true) {
            return false
        }

        return this._platformBridge.isAdvancedBannersSupported
    }

    get advancedBannersState(): BannerState {
        return this.#advancedBannersState
    }

    #bannerState: BannerState = BANNER_STATE.HIDDEN

    #bannerPosition: BannerPosition | null = null

    #bannerPlacement: string | null = null

    #interstitialState: InterstitialState = INTERSTITIAL_STATE.CLOSED

    #interstitialPlacement: string | null = null

    #interstitialTimer: Timer | undefined

    #minimumDelayBetweenInterstitial: number = DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL

    #initTime: number | null = null

    #rewardedState: RewardedState = REWARDED_STATE.CLOSED

    #rewardedPlacement: string | null = null

    #advancedBannersState: BannerState = BANNER_STATE.HIDDEN

    #advancedBannersPlacement: string | null = null

    #advancedBannersConfig: unknown = null

    #advancedBannersHiddenByAd = false

    #advancedBannersConditionsTimer: ReturnType<typeof setTimeout> | null = null

    constructor(platformBridge: AdvertisementBridgeContract) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.BANNER_STATE_CHANGED,
            (state: unknown) => this.#setBannerState(state as BannerState),
        )

        this._platformBridge.on(
            EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
            (state: unknown) => {
                const typedState = state as InterstitialState
                this.#setInterstitialState(typedState)

                if (typedState === INTERSTITIAL_STATE.LOADING || typedState === INTERSTITIAL_STATE.OPENED) {
                    this.#hideAdvancedBannersByAd()
                } else if (typedState === INTERSTITIAL_STATE.CLOSED || typedState === INTERSTITIAL_STATE.FAILED) {
                    this.#restoreAdvancedBannersAfterAd()
                }

                if (typedState === INTERSTITIAL_STATE.CLOSED) {
                    this.#startInterstitialTimer()
                }
            },
        )

        this._platformBridge.on(
            EVENT_NAME.REWARDED_STATE_CHANGED,
            (state: unknown) => {
                const typedState = state as RewardedState
                this.#setRewardedState(typedState)

                if (typedState === REWARDED_STATE.LOADING || typedState === REWARDED_STATE.OPENED) {
                    this.#hideAdvancedBannersByAd()
                } else if (typedState === REWARDED_STATE.CLOSED || typedState === REWARDED_STATE.FAILED) {
                    this.#restoreAdvancedBannersAfterAd()
                }
            },
        )

        this._platformBridge.on(
            EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED,
            (state: unknown) => this.#setAdvancedBannersState(state as BannerState),
        )

        eventBus.on(
            EVENT_NAME.PLATFORM_MESSAGE_SENT,
            (message: unknown) => this.#onPlatformMessageSent(message as string),
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

    setMinimumDelayBetweenInterstitial(value: unknown): void {
        const configDelay = this.#parseDelay(
            this.#getConfigMinimumDelayBetweenInterstitial(),
        )
        if (configDelay !== null) {
            return
        }

        const delay = this.#parseDelay(value)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelayBetweenInterstitial(delay)
    }

    showBanner(position: BannerPosition = BANNER_POSITION.BOTTOM, placement: string | null = null): void {
        if (this.bannerState === BANNER_STATE.LOADING || this.bannerState === BANNER_STATE.SHOWN) {
            return
        }

        const validPosition = (Object.values(BANNER_POSITION) as string[]).includes(position)
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

    hideBanner(): void {
        if (this.bannerState === BANNER_STATE.LOADING || this.bannerState === BANNER_STATE.HIDDEN) {
            return
        }

        if (!this.isBannerSupported) {
            return
        }

        this._platformBridge.hideBanner()
    }

    preloadInterstitial(placement: string | null = null): void {
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

    showInterstitial(placement: string | null = null): void {
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

        const initialDelay = this.#getInitialInterstitialDelay()
        if (initialDelay > 0) {
            if (this.#initTime === null || (Date.now() - this.#initTime) / 1000 < initialDelay) {
                this.#setInterstitialState(INTERSTITIAL_STATE.FAILED)
                return
            }
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

    preloadRewarded(placement: string | null = null): void {
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

    showRewarded(placement: string | null = null): void {
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

    showAdvancedBanners(placement: string | null): void {
        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            const fallback = (this.#advancedBannersOptions as AnyRecord | undefined)?.placementFallback
            if (typeof fallback === 'string') {
                modifiedPlacement = fallback
            }
        }
        this.#tryToShowAdvancedBanners(modifiedPlacement)
    }

    hideAdvancedBanners(): void {
        if (!this.isAdvancedBannersSupported) {
            return
        }

        this.#hideAdvancedBannersIfVisible()
        this.#resetAdvancedBannersState()
        this.#setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }

    checkAdBlock(): Promise<unknown> {
        return this._platformBridge.checkAdBlock()
    }

    #applyMinimumDelayBetweenInterstitial(delay: number): void {
        this.#minimumDelayBetweenInterstitial = delay

        if (this.#interstitialTimer) {
            this.#interstitialTimer.stop()
            this.#startInterstitialTimer()
        }
    }

    #parseDelay(value: unknown): number | null {
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

    #applyConfigMinimumDelayBetweenInterstitial(): void {
        const configDelay = this.#getConfigMinimumDelayBetweenInterstitial()
        if (configDelay === undefined) {
            return
        }

        const delay = this.#parseDelay(configDelay)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelayBetweenInterstitial(delay)
    }

    #getConfigMinimumDelayBetweenInterstitial(): number | string | undefined {
        return this._platformBridge.options?.advertisement?.minimumDelayBetweenInterstitial
    }

    #getInitialInterstitialDelay(): number {
        const configDelay = this._platformBridge.options?.advertisement?.initialInterstitialDelay
        const delay = this.#parseDelay(configDelay)
        if (delay !== null) {
            return delay
        }

        return this._platformBridge.initialInterstitialDelay
    }

    #startInterstitialTimer(): void {
        if (
            this.#minimumDelayBetweenInterstitial > 0
            && this._platformBridge.isMinimumDelayBetweenInterstitialEnabled
        ) {
            this.#interstitialTimer = new Timer(this.#minimumDelayBetweenInterstitial)
            this.#interstitialTimer.start()
        }
    }

    #hasAdvertisementInProgress(): boolean {
        const isInterstitialInProgress = ([
            INTERSTITIAL_STATE.LOADING,
            INTERSTITIAL_STATE.OPENED,
        ] as InterstitialState[]).includes(this.#interstitialState)

        const isRewardedInProgress = ([
            REWARDED_STATE.LOADING,
            REWARDED_STATE.OPENED,
            REWARDED_STATE.REWARDED,
        ] as RewardedState[]).includes(this.#rewardedState)

        return isInterstitialInProgress || isRewardedInProgress
    }

    #setAdvancedBannersState(state: BannerState): void {
        if (this.#advancedBannersState === state) {
            return
        }

        this.#advancedBannersState = state;
        (analyticsModule as unknown as AnalyticsModuleLike).send(
            `${MODULE_NAME.ADVERTISEMENT}_advanced_banners_${state}`,
            { placement: this.#advancedBannersPlacement },
        )

        eventBus.emit(EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, this.#advancedBannersState)
    }

    #setBannerState(state: BannerState): void {
        if (this.#bannerState === state) {
            return
        }

        this.#bannerState = state;
        (analyticsModule as unknown as AnalyticsModuleLike).send(
            `${MODULE_NAME.ADVERTISEMENT}_banner_${state}`,
            { position: this.#bannerPosition, placement: this.#bannerPlacement },
        )

        eventBus.emit(EVENT_NAME.BANNER_STATE_CHANGED, this.#bannerState)
    }

    #setInterstitialState(state: InterstitialState): void {
        if (this.#interstitialState === state) {
            return
        }

        this.#interstitialState = state;
        (analyticsModule as unknown as AnalyticsModuleLike).send(
            `${MODULE_NAME.ADVERTISEMENT}_interstitial_${state}`,
            { placement: this.#interstitialPlacement },
        )

        eventBus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, this.#interstitialState)
    }

    #setRewardedState(state: RewardedState): void {
        if (this.#rewardedState === state) {
            return
        }

        this.#rewardedState = state;
        (analyticsModule as unknown as AnalyticsModuleLike).send(
            `${MODULE_NAME.ADVERTISEMENT}_rewarded_${state}`,
            { placement: this.#rewardedPlacement },
        )

        eventBus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, this.#rewardedState)
    }

    #onPlatformMessageSent(message: string): void {
        if (message === PLATFORM_MESSAGE.GAME_READY) {
            this.#initTime = Date.now()
        }

        this.#tryToShowAdvancedBanners(message)
    }

    #tryToShowAdvancedBanners(placement: string | null): void {
        if (!this.isAdvancedBannersSupported) {
            return
        }

        if (placement === null) {
            return
        }

        const placementConfig = (this.#advancedBannersOptions as AnyRecord | undefined)?.[placement] as
            | AdvancedBannersPlacementConfig
            | undefined
        if (!placementConfig) {
            return
        }

        const action = placementConfig.action ?? ADVANCED_BANNERS_ACTION.SHOW

        if (action === ADVANCED_BANNERS_ACTION.HIDE) {
            this.#hideAdvancedBannersIfVisible()
            this.#resetAdvancedBannersState()
            return
        }

        this.#setAdvancedBannersState(BANNER_STATE.LOADING)

        const config = this.#resolveAdvancedBanners(placementConfig)

        this.#advancedBannersPlacement = placement

        if (this.#advancedBannersConfig && !config) {
            this._platformBridge.hideAdvancedBanners()
        }

        this.#advancedBannersConfig = config

        if (!config) {
            this.#setAdvancedBannersState(BANNER_STATE.FAILED)
            return
        }

        if (this.#hasAdvertisementInProgress()) {
            this.#advancedBannersHiddenByAd = true
            return
        }

        this._platformBridge.showAdvancedBanners(config)
    }

    #onAdvancedBannersConditionsChanged(): void {
        if (this.#advancedBannersConditionsTimer) {
            clearTimeout(this.#advancedBannersConditionsTimer)
        }

        this.#advancedBannersConditionsTimer = setTimeout(() => {
            this.#advancedBannersConditionsTimer = null
            this.#handleAdvancedBannersConditionsChanged()
        }, ADVANCED_BANNERS_CONDITIONS_DEBOUNCE)
    }

    #handleAdvancedBannersConditionsChanged(): void {
        if (!this.#advancedBannersPlacement) {
            return
        }

        const messageConfig = (this.#advancedBannersOptions as AnyRecord | undefined)?.[this.#advancedBannersPlacement] as
            | AdvancedBannersPlacementConfig
            | undefined
        if (!messageConfig) {
            return
        }

        const config = this.#resolveAdvancedBanners(messageConfig)

        if (config === this.#advancedBannersConfig) {
            return
        }

        const hadConfig = this.#advancedBannersConfig
        this.#advancedBannersConfig = config

        if (this.#advancedBannersHiddenByAd) {
            return
        }

        if (hadConfig) {
            this._platformBridge.hideAdvancedBanners()
        }

        if (config) {
            this._platformBridge.showAdvancedBanners(config)
        } else if (hadConfig) {
            this.#setAdvancedBannersState(BANNER_STATE.HIDDEN)
        }
    }

    get #advancedBannersOptions(): AdvertisementOptions['advancedBanners'] {
        return this._platformBridge.options?.advertisement?.advancedBanners
    }

    #resetAdvancedBannersState(): void {
        this.#advancedBannersPlacement = null
        this.#advancedBannersConfig = null
        this.#advancedBannersHiddenByAd = false
    }

    #hideAdvancedBannersIfVisible(): void {
        if (this.#advancedBannersConfig && !this.#advancedBannersHiddenByAd) {
            this._platformBridge.hideAdvancedBanners()
        }
    }

    #hideAdvancedBannersByAd(): void {
        if (!this.#advancedBannersConfig || this.#advancedBannersHiddenByAd) {
            return
        }

        this.#advancedBannersHiddenByAd = true
        this._platformBridge.hideAdvancedBanners()
    }

    #restoreAdvancedBannersAfterAd(): void {
        if (!this.#advancedBannersHiddenByAd) {
            return
        }

        if (this.#hasAdvertisementInProgress()) {
            return
        }

        this.#advancedBannersHiddenByAd = false

        if (this.#advancedBannersConfig) {
            this._platformBridge.showAdvancedBanners(this.#advancedBannersConfig)
        }
    }

    #resolveAdvancedBanners(messageConfig: AdvancedBannersPlacementConfig): unknown {
        const { deviceType } = this._platformBridge
        const orientation = detectOrientation()
        const canvas = findGameCanvas()

        const context: AdvancedBannerMatchContext = {
            deviceType, orientation, canvas,
        }

        let bestKey = 'default'
        let bestBanners: unknown = messageConfig.default ?? null
        let bestScore = -1

        Object.keys(messageConfig)
            .filter((key) => key !== 'action' && key !== 'default')
            .forEach((key) => {
                const result = this.#matchAdvancedBannerKey(key, context)

                if (!result.matched) {
                    return
                }

                const isBetter = result.score > bestScore
                    || (result.score === bestScore && key.split(':').length > bestKey.split(':').length)
                if (isBetter) {
                    bestScore = result.score
                    bestKey = key
                    bestBanners = (messageConfig as AnyRecord)[key]
                }
            })

        return bestBanners
    }

    #matchAdvancedBannerKey(key: string, context: AdvancedBannerMatchContext): { matched: boolean; score: number } {
        const { deviceType, orientation, canvas } = context
        const segments = key.split(':')
        const useCanvas = segments.includes('canvas')
        let score = 0

        if (useCanvas && !canvas) {
            return { matched: false, score }
        }

        if (useCanvas) {
            score += ADVANCED_BANNERS_SCORE.CANVAS
        }

        const matched = segments.every((segment) => {
            if (segment === 'canvas') {
                return true
            }

            if (DEVICE_TYPES_SET.has(segment)) {
                if (segment !== deviceType) {
                    return false
                }
                score += ADVANCED_BANNERS_SCORE.DEVICE_TYPE
            } else if (ORIENTATIONS_SET.has(segment)) {
                if (segment !== orientation) {
                    return false
                }
                score += ADVANCED_BANNERS_SCORE.ORIENTATION
            } else {
                const dimensionMatch = /^([wh])([><]=?)(\d+)$/.exec(segment)
                const arMatch = /^ar([><]=?)(\d+(?:\.\d+)?)$/.exec(segment)

                if (dimensionMatch) {
                    const screenWidth = useCanvas && canvas ? canvas.width : window.innerWidth
                    const screenHeight = useCanvas && canvas ? canvas.height : window.innerHeight
                    const dimension = dimensionMatch[1] === 'w' ? screenWidth : screenHeight
                    const operator = dimensionMatch[2]
                    const value = parseInt(dimensionMatch[3], 10)

                    if (!this.#evaluateScreenCondition(dimension, operator, value)) {
                        return false
                    }
                    score += ADVANCED_BANNERS_SCORE.DIMENSION
                        + this.#computeSpecificityBonus(dimension, value)
                } else if (arMatch) {
                    const screenWidth = useCanvas && canvas ? canvas.width : window.innerWidth
                    const screenHeight = useCanvas && canvas ? canvas.height : window.innerHeight
                    const aspectRatio = screenWidth / screenHeight
                    const operator = arMatch[1]
                    const value = parseFloat(arMatch[2])

                    if (!this.#evaluateScreenCondition(aspectRatio, operator, value)) {
                        return false
                    }
                    score += ADVANCED_BANNERS_SCORE.DIMENSION
                        + this.#computeSpecificityBonus(aspectRatio, value, 1000)
                } else {
                    return false
                }
            }

            return true
        })

        return { matched, score }
    }

    #evaluateScreenCondition(dimension: number, operator: string, value: number): boolean {
        switch (operator) {
            case '>': return dimension > value
            case '<': return dimension < value
            case '>=': return dimension >= value
            case '<=': return dimension <= value
            default: return false
        }
    }

    #computeSpecificityBonus(actual: number, threshold: number, scale = 1): number {
        return 0.9 / (1 + Math.abs(actual - threshold) * scale)
    }

    #getPlatformPlacement(id: string | null | undefined, placements: PlacementMapping[] | undefined): string | null {
        if (!id) {
            return id ?? null
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
