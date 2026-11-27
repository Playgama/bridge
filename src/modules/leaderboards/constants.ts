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

export const LEADERBOARD_TYPE = {
    NOT_AVAILABLE: 'not_available',
    IN_GAME: 'in_game',
    NATIVE: 'native',
    NATIVE_POPUP: 'native_popup',
} as const
export type LeaderboardType = typeof LEADERBOARD_TYPE[keyof typeof LEADERBOARD_TYPE]

// Standing a leaderboard read returns. Every Playgama SaaS leaderboard keeps all
// of them from the same scores; daily/weekly/monthly reset at 00:00 UTC (weekly
// on Monday, monthly on the 1st). Platform leaderboards only have permanent.
export const LEADERBOARD_PERIOD = {
    PERMANENT: 'permanent',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
} as const
export type LeaderboardPeriod = typeof LEADERBOARD_PERIOD[keyof typeof LEADERBOARD_PERIOD]
