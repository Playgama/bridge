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
import Timer, { STATE as TIMER_STATE } from '../../lib/Timer'
import { EVENT_NAME, MODULE_NAME } from '../../constants'
import { PLATFORM_MESSAGE } from '../platform/constants'
import {
    DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL,
    INTERSTITIAL_STATE,
    type InterstitialState,
} from './constants'
import { getPlatformPlacement, parseDelay } from './helpers'
import type { AdvertisementBridgeContract, AnalyticsSender } from './types'

class InterstitialController {
    get isSupported(): boolean {
        const disable = this.#bridge.options?.advertisement?.interstitial?.disable
        if (disable === true) {
            return false
        }

        return this.#bridge.isInterstitialSupported
    }

    get state(): InterstitialState {
        return this.#state
    }

    get minimumDelayBetweenInterstitial(): number {
        return this.#minimumDelay
    }

    get isInProgress(): boolean {
        return ([
            INTERSTITIAL_STATE.LOADING,
            INTERSTITIAL_STATE.OPENED,
        ] as InterstitialState[]).includes(this.#state)
    }

    #bridge: AdvertisementBridgeContract

    #analytics: AnalyticsSender

    #state: InterstitialState = INTERSTITIAL_STATE.CLOSED

    #placement: string | null = null

    #timer: Timer | undefined

    #minimumDelay: number = DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL

    #initTime: number | null = null

    #onStateChange: (state: InterstitialState) => void

    constructor(
        bridge: AdvertisementBridgeContract,
        analytics: AnalyticsSender,
        onStateChange: (state: InterstitialState) => void,
    ) {
        this.#bridge = bridge
        this.#analytics = analytics
        this.#onStateChange = onStateChange

        this.#bridge.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state: unknown) => {
            const typedState = state as InterstitialState
            this.#setState(typedState)

            if (typedState === INTERSTITIAL_STATE.CLOSED) {
                this.#startTimer()
            }
        })

        eventBus.on(EVENT_NAME.PLATFORM_MESSAGE_SENT, (message: unknown) => {
            if (message === PLATFORM_MESSAGE.GAME_READY) {
                this.#initTime = Date.now()
            }
        })

        this.#applyConfigMinimumDelay()
    }

    preload(placement: string | null = null): void {
        if (!this.isSupported) {
            return
        }

        let modifiedPlacement = placement
        if (!modifiedPlacement || typeof modifiedPlacement !== 'string') {
            const fallback = this.#bridge.options?.advertisement?.interstitial?.placementFallback
            if (fallback) {
                modifiedPlacement = fallback
            }
        }

        const placements = this.#bridge.options?.advertisement?.interstitial?.placements
        const platformPlacement = getPlatformPlacement(modifiedPlacement, placements, this.#bridge.platformId)
        this.#bridge.preloadInterstitial(platformPlacement)
    }

    show(placement: string | null = null): void {
        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            const fallback = this.#bridge.options?.advertisement?.interstitial?.placementFallback
            if (fallback) {
                modifiedPlacement = fallback
            }
        }
        this.#placement = modifiedPlacement

        this.#setState(INTERSTITIAL_STATE.LOADING)

        if (!this.isSupported) {
            this.#setState(INTERSTITIAL_STATE.FAILED)
            return
        }

        const initialDelay = this.#getInitialDelay()
        if (initialDelay > 0) {
            if (this.#initTime === null || (Date.now() - this.#initTime) / 1000 < initialDelay) {
                this.#setState(INTERSTITIAL_STATE.FAILED)
                return
            }
        }

        if (this.#bridge.isMinimumDelayBetweenInterstitialEnabled) {
            if (this.#timer && this.#timer.state === TIMER_STATE.STARTED) {
                this.#setState(INTERSTITIAL_STATE.FAILED)
                return
            }
        }

        const placements = this.#bridge.options?.advertisement?.interstitial?.placements
        const platformPlacement = getPlatformPlacement(modifiedPlacement, placements, this.#bridge.platformId)
        this.#bridge.showInterstitial(platformPlacement)
    }

    setMinimumDelay(value: unknown): void {
        const configDelay = parseDelay(this.#getConfigMinimumDelay())
        if (configDelay !== null) {
            return
        }

        const delay = parseDelay(value)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelay(delay)
    }

    #setState(state: InterstitialState): void {
        if (this.#state === state) {
            return
        }

        this.#state = state
        if (state !== INTERSTITIAL_STATE.LOADING) {
            this.#analytics.send(
                `${MODULE_NAME.ADVERTISEMENT}_interstitial_${state}`,
                { placement: this.#placement },
            )
        }

        eventBus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, this.#state)
        this.#onStateChange(this.#state)
    }

    #applyConfigMinimumDelay(): void {
        const configDelay = this.#getConfigMinimumDelay()
        if (configDelay === undefined) {
            return
        }

        const delay = parseDelay(configDelay)
        if (delay === null) {
            return
        }

        this.#applyMinimumDelay(delay)
    }

    #applyMinimumDelay(delay: number): void {
        this.#minimumDelay = delay

        if (this.#timer) {
            this.#timer.stop()
            this.#startTimer()
        }
    }

    #getConfigMinimumDelay(): number | string | undefined {
        return this.#bridge.options?.advertisement?.minimumDelayBetweenInterstitial
    }

    #getInitialDelay(): number {
        const configDelay = this.#bridge.options?.advertisement?.initialInterstitialDelay
        const delay = parseDelay(configDelay)
        if (delay !== null) {
            return delay
        }

        return this.#bridge.initialInterstitialDelay
    }

    #startTimer(): void {
        if (
            this.#minimumDelay > 0
            && this.#bridge.isMinimumDelayBetweenInterstitialEnabled
        ) {
            this.#timer = new Timer(this.#minimumDelay)
            this.#timer.start()
        }
    }
}

export default InterstitialController
