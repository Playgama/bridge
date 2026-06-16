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
import configLoader from '../../lib/bridge-config-loader'
import { getAchievementPlatformData } from './helpers'
import type {
    AchievementMapping,
    AchievementsBridgeContract,
    NormalizedAchievement,
} from './types'

class AchievementsModule extends ModuleBase<AchievementsBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isAchievementsSupported
    }

    unlock(id: string): Promise<unknown> {
        if (!this._platformBridge.isAchievementsSupported) {
            return Promise.reject()
        }

        const platformData = getAchievementPlatformData(
            this.#getAchievementsConfig(),
            this._platformBridge.platformId,
            id,
        )
        return this._platformBridge.achievementsUnlock(platformData)
    }

    // The platform bridge returns the list already normalized, with ids
    // mapped back to the game-level ids from the config.
    getList(): Promise<NormalizedAchievement[]> {
        if (!this._platformBridge.isAchievementsSupported) {
            return Promise.reject()
        }

        return this._platformBridge.achievementsGetList()
    }

    #getAchievementsConfig(): AchievementMapping[] | undefined {
        const options = configLoader.getPlatformOptions(this._platformBridge.platformId)
        return options?.achievements as AchievementMapping[] | undefined
    }
}

export default AchievementsModule
