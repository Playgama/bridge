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
import type { AchievementMapping, AchievementPlatformData } from './types'

// Resolves the game-level id to the platform-specific data object from the
// config mapping. Falls back to the id itself when there is no mapping for
// the achievement or for the platform.
export function getAchievementPlatformData(
    achievements: AchievementMapping[] | undefined,
    platformId: string,
    id: string,
): AchievementPlatformData {
    if (!id || !achievements) {
        return id
    }

    const achievement = achievements.find((a) => a.id === id)
    if (!achievement) {
        return id
    }

    const platformData = achievement[platformId]
    if (platformData && typeof platformData === 'object') {
        return platformData
    }

    return id
}

// Reverse lookup for platform bridges: finds the game-level id of the mapping
// whose platform data matches the given predicate. Each bridge supplies its
// own predicate because only it knows which field identifies an achievement
// on its platform (e.g. Y8's achievementkey).
export function findAchievementGameId(
    achievements: AchievementMapping[] | undefined,
    platformId: string,
    predicate: (platformData: AnyRecord) => boolean,
): string | null {
    if (!achievements) {
        return null
    }

    const achievement = achievements.find((a) => {
        const platformData = a[platformId]
        return Boolean(platformData && typeof platformData === 'object' && predicate(platformData))
    })

    return achievement ? achievement.id : null
}
