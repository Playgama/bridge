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
import type { PlatformId } from '../platform/constants'
import type { AnyRecord } from '../../utils'

export interface DailyRewardsConfig {
    // Ordered list of reward ids, one per day.
    rewards: string[]
    cycle?: boolean
    resetOnMiss?: boolean
}

export interface DailyRewardsState {
    // 0-based index of the reward the player will claim next.
    day: number
    // UTC epoch-day number of the last successful claim, or null if never claimed.
    lastClaimEpochDay: number | null
}

export interface DailyRewardsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options?: AnyRecord
    getServerTime(): Promise<number>
    // Optional observability hooks; implemented by bridges that surface daily
    // rewards activity to an external tool (e.g. QA Tool).
    dailyRewardsClaimed?(options: { day: number, reward: string }): void
    dailyRewardsReset?(options: { day: number }): void
}
