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
import { EVENT_NAME, MODULE_NAME } from '../../constants'
import { REWARDED_STATE, type RewardedState } from './constants'
import { getPlatformPlacement } from './helpers'
import type { AdvertisementBridgeContract, AnalyticsSender } from './types'

class RewardedController {
    get isSupported(): boolean {
        const disable = this.#bridge.options?.advertisement?.rewarded?.disable
        if (disable === true) {
            return false
        }

        return this.#bridge.isRewardedSupported
    }

    get state(): RewardedState {
        return this.#state
    }

    get placement(): string | null {
        return this.#placement
    }

    get isInProgress(): boolean {
        return ([
            REWARDED_STATE.LOADING,
            REWARDED_STATE.OPENED,
            REWARDED_STATE.REWARDED,
        ] as RewardedState[]).includes(this.#state)
    }

    #bridge: AdvertisementBridgeContract

    #analytics: AnalyticsSender

    #state: RewardedState = REWARDED_STATE.CLOSED

    #placement: string | null = null

    #onStateChange: (state: RewardedState) => void

    constructor(
        bridge: AdvertisementBridgeContract,
        analytics: AnalyticsSender,
        onStateChange: (state: RewardedState) => void,
    ) {
        this.#bridge = bridge
        this.#analytics = analytics
        this.#onStateChange = onStateChange

        this.#bridge.on(
            EVENT_NAME.REWARDED_STATE_CHANGED,
            (state: unknown) => this.#setState(state as RewardedState),
        )
    }

    preload(placement: string | null = null): void {
        if (!this.isSupported) {
            return
        }

        let modifiedPlacement = placement
        if (!modifiedPlacement || typeof modifiedPlacement !== 'string') {
            const fallback = this.#bridge.options?.advertisement?.rewarded?.placementFallback
            if (fallback) {
                modifiedPlacement = fallback
            }
        }

        const placements = this.#bridge.options?.advertisement?.rewarded?.placements
        const platformPlacement = getPlatformPlacement(modifiedPlacement, placements, this.#bridge.platformId)
        this.#bridge.preloadRewarded(platformPlacement)
    }

    show(placement: string | null = null): void {
        this.#placement = placement
        if (!this.#placement) {
            const fallback = this.#bridge.options?.advertisement?.rewarded?.placementFallback
            if (fallback) {
                this.#placement = fallback
            }
        }

        const placements = this.#bridge.options?.advertisement?.rewarded?.placements
        const platformPlacement = getPlatformPlacement(this.#placement, placements, this.#bridge.platformId)

        this.#setState(REWARDED_STATE.LOADING)
        if (!this.isSupported) {
            this.#setState(REWARDED_STATE.FAILED)
            return
        }
        this.#bridge.showRewarded(platformPlacement)
    }

    #setState(state: RewardedState): void {
        if (this.#state === state) {
            return
        }

        this.#state = state
        if (state !== REWARDED_STATE.LOADING) {
            this.#analytics.send(
                `${MODULE_NAME.ADVERTISEMENT}_rewarded_${state}`,
                { placement: this.#placement },
            )
        }

        eventBus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, this.#state)
        this.#onStateChange(this.#state)
    }
}

export default RewardedController
