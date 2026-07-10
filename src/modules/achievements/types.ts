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

// What a platform bridge receives from the module: the platform-specific data
// object from the config mapping (e.g. { achievement, achievementkey } for Y8,
// { id } for Lagged), or the plain game-level id when there is no mapping.
export type AchievementPlatformData = string | AnyRecord

// Config mapping entry: a game-level id plus a data object per platform.
// `name` and `description` are optional game-level metadata used by the
// SDK-managed local fallback (see LocalAchievements) on platforms without
// native achievements support.
export interface AchievementMapping {
    id: string
    name?: string
    description?: string
    [platform: string]: string | AnyRecord | undefined
}

// State persisted by the SDK-managed local fallback: the game-level ids the
// player has unlocked so far.
export interface LocalAchievementsState {
    unlocked: string[]
}

// Platform-agnostic achievement shape returned by achievementsGetList().
// Platform bridges normalize their raw responses to this, mapping the
// platform-specific ids back to the game-level ids from the config.
// Kept flat on purpose: engine SDKs (e.g. Unity) parse it with simple
// parsers that do not support nested objects.
export interface NormalizedAchievement {
    id: string
    name?: string
    description?: string
    unlocked: boolean
}

export interface AchievementsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isAchievementsSupported: boolean
    achievementsUnlock(data: AchievementPlatformData): Promise<unknown>
    achievementsGetList(): Promise<NormalizedAchievement[]>
}
