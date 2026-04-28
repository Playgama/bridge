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
import type { LeaderboardType, PlatformId } from '../constants'

export interface LeaderboardMapping {
    id: string
    isMain?: boolean
    [platform: string]: string | boolean | undefined
}

export interface LeaderboardsBridgeOptions {
    leaderboards?: LeaderboardMapping[]
    [key: string]: unknown
}

export interface LeaderboardsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    leaderboardsType: LeaderboardType
    options: LeaderboardsBridgeOptions
    leaderboardsSetScore(id: string | null | undefined, score: number, isMain: boolean): Promise<unknown>
    leaderboardsGetEntries(id: string | null | undefined): Promise<unknown>
    leaderboardsShowNativePopup(id: string | null | undefined): Promise<unknown>
}

class LeaderboardsModule<
    TBridge extends LeaderboardsBridgeContract = LeaderboardsBridgeContract,
> extends ModuleBase<TBridge> {
    get type(): LeaderboardType {
        return this._platformBridge.leaderboardsType
    }

    setScore(id: string, score: number): Promise<unknown> {
        const modifiedId = this._getPlatformLeaderboardId(id)
        const isMain = this.#getIsMain(id)

        return this._platformBridge.leaderboardsSetScore(modifiedId, score, isMain)
    }

    getEntries(id: string): Promise<unknown> {
        const modifiedId = this._getPlatformLeaderboardId(id)

        return this._platformBridge.leaderboardsGetEntries(modifiedId)
    }

    showNativePopup(id: string): Promise<unknown> {
        const modifiedId = this._getPlatformLeaderboardId(id)
        return this._platformBridge.leaderboardsShowNativePopup(modifiedId)
    }

    protected _getPlatformLeaderboardId(id: string | null | undefined): string | null | undefined {
        if (!id) {
            return id
        }

        const leaderboards = this._platformBridge.options?.leaderboards
        if (!leaderboards) {
            return id
        }

        const leaderboard = leaderboards.find((p) => p.id === id)
        if (!leaderboard) {
            return id
        }

        const platformValue = leaderboard[this._platformBridge.platformId]
        if (typeof platformValue === 'string' && platformValue) {
            return platformValue
        }

        return id
    }

    #getIsMain(id: string): boolean {
        const leaderboards = this._platformBridge.options?.leaderboards
        if (!leaderboards) {
            return false
        }

        const leaderboard = leaderboards.find((p) => p.id === id)
        if (!leaderboard) {
            return false
        }

        return leaderboard.isMain === true
    }
}

export default LeaderboardsModule
