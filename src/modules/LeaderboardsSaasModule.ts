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

import { LEADERBOARD_TYPE, type LeaderboardType, type PlatformId } from '../constants'
import LeaderboardsModule, { type LeaderboardsBridgeContract, type LeaderboardMapping } from './LeaderboardsModule'
import SaasRequestMixin from './mixins/SaasRequestMixin'
import type { EventListener } from '../types/common'

export interface LeaderboardsSaasBridgeContract {
    platformId: PlatformId
    leaderboardsType: LeaderboardType
    playerId?: string | null
    options: {
        leaderboards?: LeaderboardMapping[]
        saas?: {
            baseUrl?: string
            publicToken?: string
        }
        [key: string]: unknown
    }
    leaderboardsSetScore(id: string | null | undefined, score: number, isMain: boolean): Promise<unknown>
    leaderboardsGetEntries(id: string | null | undefined): Promise<unknown>
    leaderboardsShowNativePopup(id: string | null | undefined): Promise<unknown>
    on(eventName: string, callback: EventListener): void
    off(eventName: string, callback?: EventListener): void
    once(eventName: string, callback: EventListener): void
    emit(eventName: string, ...args: unknown[]): void
    [key: string]: unknown
}

// Cast bridge contract to LeaderboardsBridgeContract for the generic constraint;
// the real shape is structurally compatible.
class LeaderboardsSaasModule extends SaasRequestMixin(
    LeaderboardsModule as unknown as new (
        bridge: LeaderboardsSaasBridgeContract,
    ) => LeaderboardsModule<LeaderboardsBridgeContract>,
) {
    get type(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    async setScore(leaderboardId: string, score: number): Promise<unknown> {
        return this.request.post(`leaderboards/${leaderboardId}`, { score })
    }

    async getEntries(leaderboardId: string): Promise<unknown> {
        return this.request.get(`leaderboards/${leaderboardId}`)
    }
}

export default LeaderboardsSaasModule
