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

import ModuleBase from '../ModuleBase'
import type {
    AchievementPlatformData,
    AchievementsBridgeContract,
    NormalizedAchievement,
} from './types'

class AchievementsModule extends ModuleBase<AchievementsBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isAchievementsSupported
    }

    get isGetListSupported(): boolean {
        return this._platformBridge.isGetAchievementsListSupported
    }

    get isNativePopupSupported(): boolean {
        return this._platformBridge.isAchievementsNativePopupSupported
    }

    unlock(id: string): Promise<unknown> {
        const platformData = this._getPlatformAchievementData(id)
        return this._platformBridge.achievementsUnlock(platformData)
    }

    getList(): Promise<NormalizedAchievement[]> {
        return this._platformBridge.achievementsGetList()
            .then((achievements) => achievements.map((achievement) => ({
                ...achievement,
                id: this.#getGameAchievementId(achievement.id),
            })))
    }

    showNativePopup(): Promise<unknown> {
        return this._platformBridge.achievementsShowNativePopup()
    }

    // Resolves the game-level id to the platform-specific payload from the
    // config mapping. Falls back to the id itself when there is no mapping,
    // which covers platforms where game and platform ids match.
    protected _getPlatformAchievementData(id: string): AchievementPlatformData {
        if (!id) {
            return id
        }

        const achievements = this._platformBridge.options?.achievements
        if (!achievements) {
            return id
        }

        const achievement = achievements.find((a) => a.id === id)
        if (!achievement) {
            return id
        }

        const platformValue = achievement[this._platformBridge.platformId]
        if (typeof platformValue === 'string' && platformValue) {
            return platformValue
        }

        if (platformValue && typeof platformValue === 'object') {
            return platformValue
        }

        return id
    }

    // Reverse mapping for getList(): platform-specific id -> game-level id.
    // String mappings are compared directly; for object mappings any string
    // field may act as the platform identifier (e.g. Y8's achievementkey).
    #getGameAchievementId(platformAchievementId: string): string {
        const achievements = this._platformBridge.options?.achievements
        if (!achievements) {
            return platformAchievementId
        }

        const achievement = achievements.find((a) => {
            const platformValue = a[this._platformBridge.platformId]
            if (typeof platformValue === 'string') {
                return platformValue === platformAchievementId
            }

            if (platformValue && typeof platformValue === 'object') {
                return Object.values(platformValue).includes(platformAchievementId)
            }

            return false
        })

        return achievement ? achievement.id : platformAchievementId
    }
}

export default AchievementsModule
