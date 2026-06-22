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

export function generateRandomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const randomPart = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
    const timestampPart = Date.now().toString(36)
    return `${randomPart}${timestampPart}`
}

// Deterministic PRNG (mulberry32): the same seed always yields the same sequence.
// Used where a result must be stable across reloads/devices without coordination
// (e.g. picking the same daily set for a given epoch-day). Bitwise math is inherent
// to the algorithm.
/* eslint-disable no-bitwise */
function mulberry32(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state += 0x6D2B79F5
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
/* eslint-enable no-bitwise */

// Returns a new array shuffled deterministically for the given seed (Fisher-Yates).
// Same (array length, seed) always produces the same ordering; the input is not mutated.
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
    const result = items.slice()
    const random = mulberry32(seed)
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        const temp = result[i]
        result[i] = result[j]
        result[j] = temp
    }
    return result
}
