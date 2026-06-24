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

export const QUESTS_STORAGE_KEY = 'bridge-quests-state'

export const MS_PER_DAY = 86400000

export const MS_PER_WEEK = 604800000

export const CADENCE = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    PERMANENT: 'permanent',
    EVENT: 'event',
} as const

export const SELECTION_MODE = {
    RANDOM: 'random',
    SEQUENTIAL: 'sequential',
} as const

// How a daily/weekly period is anchored. 'calendar' resets on the shared UTC
// boundary (same for all players); 'player' resets relative to the player's first
// play, giving every player a full period from when they started.
export const ANCHOR = {
    CALENDAR: 'calendar',
    PLAYER: 'player',
} as const

// Per-cadence salt so two groups that share a period number do not shuffle
// in lockstep; combined with the period to seed the deterministic selection.
export const CADENCE_SEED_SALT: Record<string, number> = {
    daily: 1,
    weekly: 2,
    permanent: 3,
    event: 4,
}

// The constant period a 'permanent' group always reports; it never rolls over.
export const PERMANENT_PERIOD = 0
