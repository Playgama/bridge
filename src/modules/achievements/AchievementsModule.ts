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
import bridgeConfig from '../../lib/bridge-config'
import { getAchievementPlatformData } from './helpers'
import LocalAchievements from './LocalAchievements'
import type {
    AchievementMapping,
    AchievementsBridgeContract,
    NormalizedAchievement,
} from './types'

class AchievementsModule extends ModuleBase<AchievementsBridgeContract> {
    // SDK-managed fallback for platforms without native achievements support.
    // Achievements are always available: handled natively when the platform
    // supports them, otherwise managed locally by the SDK.
    #local!: LocalAchievements

    initialize(platformBridge: AchievementsBridgeContract): this {
        super.initialize(platformBridge)

        this.#local = new LocalAchievements(this.#getAchievementsConfig() ?? [])
        return this
    }

    unlock(id: string): Promise<unknown> {
        if (this._platformBridge.isAchievementsSupported) {
            const platformData = getAchievementPlatformData(
                this.#getAchievementsConfig(),
                this._platformBridge.platformId,
                id,
            )
            return this._platformBridge.achievementsUnlock(platformData)
        }

        return this.#local.unlock(id)
    }

    // On native platforms the bridge returns the list already normalized, with
    // ids mapped back to the game-level ids from the config. Otherwise the SDK
    // returns the configured list with the locally tracked unlocked state (an
    // empty array when nothing is configured).
    getAchievements(): Promise<NormalizedAchievement[]> {
        if (this._platformBridge.isAchievementsSupported) {
            return this._platformBridge.achievementsGetList()
        }

        return this.#local.getList()
    }

    #getAchievementsConfig(): AchievementMapping[] | undefined {
        const options = bridgeConfig.getValues()
        return options?.achievements as AchievementMapping[] | undefined
    }
}

export default AchievementsModule
