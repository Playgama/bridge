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

import eventBus from '../../lib/EventBus'
import { detectOrientation, findGameCanvas } from '../../utils'
import { EVENT_NAME, MODULE_NAME } from '../../constants'
import type { DeviceOrientation, DeviceType } from '../device/constants'
import {
    ADVANCED_BANNERS_ACTION,
    BANNER_STATE,
    type BannerState,
} from './constants'
import {
    ADVANCED_BANNERS_CONDITIONS_DEBOUNCE,
    ADVANCED_BANNERS_SCORE,
    DEVICE_TYPES_SET,
    ORIENTATIONS_SET,
} from './constants'
import type {
    AdvancedBannersPlacementConfig,
    AdvertisementBridgeContract,
    AdvertisementOptions,
    AnalyticsSender,
} from './types'
import type { AnyRecord } from '../../utils'

interface AdvancedBannerMatchContext {
    deviceType: DeviceType
    orientation: DeviceOrientation
    canvas: HTMLCanvasElement | null
}

class AdvancedBannersController {
    get isSupported(): boolean {
        if ((this.#options as AnyRecord | undefined)?.disable === true) {
            return false
        }

        return this.#bridge.isAdvancedBannersSupported
    }

    get state(): BannerState {
        return this.#state
    }

    get options(): AdvertisementOptions['advancedBanners'] {
        return this.#options
    }

    #bridge: AdvertisementBridgeContract

    #analytics: AnalyticsSender

    #state: BannerState = BANNER_STATE.HIDDEN

    #placement: string | null = null

    #config: unknown = null

    #hiddenByAd = false

    #conditionsTimer: ReturnType<typeof setTimeout> | null = null

    #isAdInProgress: () => boolean

    constructor(
        bridge: AdvertisementBridgeContract,
        analytics: AnalyticsSender,
        isAdInProgress: () => boolean,
    ) {
        this.#bridge = bridge
        this.#analytics = analytics
        this.#isAdInProgress = isAdInProgress

        this.#bridge.on(
            EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED,
            (state: unknown) => this.#setState(state as BannerState),
        )

        eventBus.on(
            EVENT_NAME.ORIENTATION_STATE_CHANGED,
            () => this.#onConditionsChanged(),
        )

        eventBus.on(
            EVENT_NAME.SCREEN_SIZE_CHANGED,
            () => this.#onConditionsChanged(),
        )
    }

    show(placement: string | null): void {
        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            const fallback = (this.#options as AnyRecord | undefined)?.placementFallback
            if (typeof fallback === 'string') {
                modifiedPlacement = fallback
            }
        }
        this.tryShow(modifiedPlacement)
    }

    hide(): void {
        if (!this.isSupported) {
            return
        }

        this.#hideIfVisible()
        this.#resetState()
        this.#setState(BANNER_STATE.HIDDEN)
    }

    tryShow(placement: string | null): void {
        if (!this.isSupported) {
            return
        }

        if (placement === null) {
            return
        }

        const placementConfig = (this.#options as AnyRecord | undefined)?.[placement] as
            | AdvancedBannersPlacementConfig
            | undefined
        if (!placementConfig) {
            return
        }

        const action = placementConfig.action ?? ADVANCED_BANNERS_ACTION.SHOW

        if (action === ADVANCED_BANNERS_ACTION.HIDE) {
            this.#hideIfVisible()
            this.#resetState()
            return
        }

        this.#setState(BANNER_STATE.LOADING)

        const config = this.#resolve(placementConfig)

        this.#placement = placement

        if (this.#config && !config) {
            this.#bridge.hideAdvancedBanners()
        }

        this.#config = config

        if (!config) {
            this.#setState(BANNER_STATE.FAILED)
            return
        }

        if (this.#isAdInProgress()) {
            this.#hiddenByAd = true
            return
        }

        this.#bridge.showAdvancedBanners(config)
    }

    hideByAd(): void {
        if (!this.#config || this.#hiddenByAd) {
            return
        }

        this.#hiddenByAd = true
        this.#bridge.hideAdvancedBanners()
    }

    restoreAfterAd(): void {
        if (!this.#hiddenByAd) {
            return
        }

        if (this.#isAdInProgress()) {
            return
        }

        this.#hiddenByAd = false

        if (this.#config) {
            this.#bridge.showAdvancedBanners(this.#config)
        }
    }

    get #options(): AdvertisementOptions['advancedBanners'] {
        return this.#bridge.options?.advertisement?.advancedBanners
    }

    #setState(state: BannerState): void {
        if (this.#state === state) {
            return
        }

        this.#state = state
        this.#analytics.send(
            `${MODULE_NAME.ADVERTISEMENT}_advanced_banners_${state}`,
            { placement: this.#placement },
        )

        eventBus.emit(EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, this.#state)
    }

    #resetState(): void {
        this.#placement = null
        this.#config = null
        this.#hiddenByAd = false
    }

    #hideIfVisible(): void {
        if (this.#config && !this.#hiddenByAd) {
            this.#bridge.hideAdvancedBanners()
        }
    }

    #onConditionsChanged(): void {
        if (this.#conditionsTimer) {
            clearTimeout(this.#conditionsTimer)
        }

        this.#conditionsTimer = setTimeout(() => {
            this.#conditionsTimer = null
            this.#handleConditionsChanged()
        }, ADVANCED_BANNERS_CONDITIONS_DEBOUNCE)
    }

    #handleConditionsChanged(): void {
        if (!this.#placement) {
            return
        }

        const messageConfig = (this.#options as AnyRecord | undefined)?.[this.#placement] as
            | AdvancedBannersPlacementConfig
            | undefined
        if (!messageConfig) {
            return
        }

        const config = this.#resolve(messageConfig)

        if (config === this.#config) {
            return
        }

        const hadConfig = this.#config
        this.#config = config

        if (this.#hiddenByAd) {
            return
        }

        if (hadConfig) {
            this.#bridge.hideAdvancedBanners()
        }

        if (config) {
            this.#bridge.showAdvancedBanners(config)
        } else if (hadConfig) {
            this.#setState(BANNER_STATE.HIDDEN)
        }
    }

    #resolve(messageConfig: AdvancedBannersPlacementConfig): unknown {
        const { deviceType } = this.#bridge
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
                const result = this.#matchKey(key, context)

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

    #matchKey(key: string, context: AdvancedBannerMatchContext): { matched: boolean; score: number } {
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

                    if (!this.#evaluateCondition(dimension, operator, value)) {
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

                    if (!this.#evaluateCondition(aspectRatio, operator, value)) {
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

    #evaluateCondition(dimension: number, operator: string, value: number): boolean {
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
}

export default AdvancedBannersController
