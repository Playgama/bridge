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
import {
    BANNER_POSITION,
    BANNER_STATE,
    type BannerPosition,
    type BannerState,
} from './constants'
import { getPlatformPlacement } from './helpers'
import type { AdvertisementBridgeContract, AnalyticsSender } from './types'

class BannerController {
    get isSupported(): boolean {
        const disable = this.#bridge.options?.advertisement?.banner?.disable
        if (disable === true) {
            return false
        }

        return this.#bridge.isBannerSupported
    }

    get state(): BannerState {
        return this.#state
    }

    #bridge: AdvertisementBridgeContract

    #analytics: AnalyticsSender

    #state: BannerState = BANNER_STATE.HIDDEN

    #position: BannerPosition | null = null

    #placement: string | null = null

    constructor(bridge: AdvertisementBridgeContract, analytics: AnalyticsSender) {
        this.#bridge = bridge
        this.#analytics = analytics

        this.#bridge.on(
            EVENT_NAME.BANNER_STATE_CHANGED,
            (state: unknown) => this.#setState(state as BannerState),
        )
    }

    show(position: BannerPosition = BANNER_POSITION.BOTTOM, placement: string | null = null): void {
        if (this.#state === BANNER_STATE.LOADING || this.#state === BANNER_STATE.SHOWN) {
            return
        }

        const validPosition = (Object.values(BANNER_POSITION) as string[]).includes(position)
            ? position
            : BANNER_POSITION.BOTTOM

        this.#position = validPosition

        let modifiedPlacement = placement
        if (!modifiedPlacement) {
            const fallback = this.#bridge.options?.advertisement?.banner?.placementFallback
            if (fallback) {
                modifiedPlacement = fallback
            }
        }
        this.#placement = modifiedPlacement

        this.#setState(BANNER_STATE.LOADING)
        if (!this.isSupported) {
            this.#setState(BANNER_STATE.FAILED)
            return
        }

        const placements = this.#bridge.options?.advertisement?.banner?.placements
        const platformPlacement = getPlatformPlacement(modifiedPlacement, placements, this.#bridge.platformId)
        this.#bridge.showBanner(validPosition, platformPlacement)
    }

    hide(): void {
        if (this.#state === BANNER_STATE.LOADING || this.#state === BANNER_STATE.HIDDEN) {
            return
        }

        if (!this.isSupported) {
            return
        }

        this.#bridge.hideBanner()
    }

    #setState(state: BannerState): void {
        if (this.#state === state) {
            return
        }

        this.#state = state
        this.#analytics.send(
            `${MODULE_NAME.ADVERTISEMENT}_banner_${state}`,
            { position: this.#position, placement: this.#placement },
        )

        eventBus.emit(EVENT_NAME.BANNER_STATE_CHANGED, this.#state)
    }
}

export default BannerController
