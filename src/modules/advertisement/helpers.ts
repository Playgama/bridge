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

import type { PlacementMapping } from './types'

export function parseDelay(value: unknown): number | null {
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

export function getPlatformPlacement(
    id: string | null | undefined,
    placements: PlacementMapping[] | undefined,
    platformId: string,
): string | null {
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

    if (placement[platformId]) {
        return placement[platformId]
    }

    return id
}
