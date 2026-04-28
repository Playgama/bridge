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

import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import type { PlatformId } from '../constants'
import type { AnyRecord } from '../types/common'

export type AchievementsOptions = AnyRecord & Partial<Record<PlatformId, AnyRecord>>

export interface AchievementsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isAchievementsSupported: boolean
    isGetAchievementsListSupported: boolean
    isAchievementsNativePopupSupported: boolean
    unlockAchievement(options?: AchievementsOptions): Promise<unknown>
    getAchievementsList(options?: AchievementsOptions): Promise<unknown>
    showAchievementsNativePopup(options?: AchievementsOptions): Promise<unknown>
}

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

    unlock(options?: AchievementsOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.unlock(platformDependedOptions as AchievementsOptions)
            }
        }

        return this._platformBridge.unlockAchievement(options)
    }

    getList(options?: AchievementsOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.getList(platformDependedOptions as AchievementsOptions)
            }
        }

        return this._platformBridge.getAchievementsList(options)
    }

    showNativePopup(options?: AchievementsOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.showNativePopup(platformDependedOptions as AchievementsOptions)
            }
        }

        return this._platformBridge.showAchievementsNativePopup(options)
    }
}

export default AchievementsModule
