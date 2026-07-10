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

import type { PlatformBridgeLike } from '../ModuleBase'
import type { CrossPromoSource } from './constants'

// A game entry in the static config list (crossPromo.games).
export interface CrossPromoGame {
    url: string
    icon?: string
    name?: string
}

// Unified, normalized game shape returned by getGames() and consumed by the
// promo renderer, regardless of the configured data source. Carries full info
// per game so no follow-up lookup is needed.
export interface Game {
    id?: string
    name?: string
    url: string
    iconUrl?: string
    coverUrl?: string
    // Raw source object (platform SDK game / config entry), kept so integrators
    // can read platform-specific fields the normalizer does not surface.
    payload?: unknown
}

export interface CrossPromoConfig {
    title?: string
    // Where the games list comes from: the static `games` list ('config') or the
    // platform SDK catalog ('platform'). Defaults to 'config'.
    source?: CrossPromoSource
    games?: CrossPromoGame[]
}

export interface CrossPromoBridgeContract extends PlatformBridgeLike {
    isPlatformGamesListSupported: boolean
    getGamesList(): Promise<unknown[]>
}
