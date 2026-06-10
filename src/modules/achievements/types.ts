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

// Platform-specific payload from the config mapping: a plain id for platforms
// that need one value (e.g. Lagged) or an object for platforms that need
// several fields (e.g. Y8 with achievement + achievementkey).
export type AchievementPlatformData = string | AnyRecord

export interface AchievementMapping {
    id: string
    [platform: string]: AchievementPlatformData | undefined
}

export interface AchievementsBridgeOptions {
    achievements?: AchievementMapping[]
    [key: string]: unknown
}

// Platform-agnostic achievement shape. Platform bridges normalize their raw
// responses to this in achievementsGetList(); the module then replaces the
// platform-specific `id` with the game-level id from the config mapping.
export interface NormalizedAchievement {
    id: string
    name?: string
    description?: string
    unlocked: boolean
    platformData?: Record<string, unknown>
}

export interface AchievementsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options: AchievementsBridgeOptions
    isAchievementsSupported: boolean
    isGetAchievementsListSupported: boolean
    isAchievementsNativePopupSupported: boolean
    achievementsUnlock(data: AchievementPlatformData): Promise<unknown>
    achievementsGetList(): Promise<NormalizedAchievement[]>
    achievementsShowNativePopup(): Promise<unknown>
}
