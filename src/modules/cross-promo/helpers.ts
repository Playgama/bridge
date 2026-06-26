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

import type { AnyRecord } from '../../utils'
import type { CrossPromoGame, Game } from './types'

// Returns a non-empty string or undefined, so optional fields stay clean.
function toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

// Normalizes a static config entry ({ url, icon, name }) to the unified Game shape.
export function normalizeConfigGame(game: CrossPromoGame): Game {
    return {
        name: toOptionalString(game.name),
        url: game.url,
        iconUrl: toOptionalString(game.icon),
        payload: game,
    }
}

// Normalizes a raw game object from a platform SDK catalog (e.g. Yandex GamesAPI)
// to the unified Game shape. Field names vary between platforms, so we probe the
// common ones and keep the raw object in `payload`.
export function normalizePlatformGame(raw: AnyRecord): Game {
    const id = raw.appID ?? raw.id
    return {
        id: id === undefined || id === null ? undefined : String(id),
        name: toOptionalString(raw.title) ?? toOptionalString(raw.name),
        url: toOptionalString(raw.url) ?? '',
        iconUrl: toOptionalString(raw.coverURL)
            ?? toOptionalString(raw.icon)
            ?? toOptionalString(raw.iconUrl),
        coverUrl: toOptionalString(raw.coverURL) ?? toOptionalString(raw.coverUrl),
        payload: raw,
    }
}

// Fisher-Yates shuffle, then take the first `count`. Returns a copy.
export function pickRandomGames(games: Game[], count: number): Game[] {
    if (games.length <= count) {
        return games.slice()
    }

    const pool = games.slice()
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = pool[i]
        pool[i] = pool[j]
        pool[j] = temp
    }
    return pool.slice(0, count)
}
