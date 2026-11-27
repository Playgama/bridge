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

import type { LeaderboardPeriod, LeaderboardScoreMode } from './constants'

// Unified leaderboard entry shape. Platforms that expose entries (Yandex, Y8,
// in-game/SaaS) normalize to these fields; `photo` may be null when the
// platform provides no avatar.
export interface LeaderboardEntry {
    id: string
    name: string
    score: number
    rank: number
    photo: string | null
}

export interface LeaderboardEntriesOptions {
    period?: LeaderboardPeriod
}

// What the game needs to build leaderboard tabs. `periods` lists the
// standings getEntries can return; `timeLeft` holds the whole seconds until
// each resetting period starts over (empty for platform leaderboards).
export interface LeaderboardInfo {
    id: string
    scoreMode: LeaderboardScoreMode
    periods: LeaderboardPeriod[]
    timeLeft: Partial<Record<LeaderboardPeriod, number>>
}
