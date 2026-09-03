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

import ModuleBase, { type PlatformBridgeLike } from '../ModuleBase'
import type { PlatformId } from '../platform/constants'
import { MODULE_NAME } from '../../constants'
import { LEADERBOARD_TYPE, type LeaderboardType } from './constants'
import type { LeaderboardEntry } from './types'
import bridgeConfig from '../../lib/bridge-config'
import SaasRequest, { type SaasBridgeLike } from '../../lib/SaasRequest'

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
    playerId: string | null
    leaderboardsType: LeaderboardType
    options: LeaderboardsBridgeOptions
    leaderboardsSetScore(id: string | null | undefined, score: number, isMain: boolean): Promise<unknown>
    leaderboardsGetEntries(id: string | null | undefined): Promise<unknown>
    leaderboardsShowNativePopup(id: string | null | undefined): Promise<unknown>
}

class LeaderboardsModule extends ModuleBase<LeaderboardsBridgeContract> {
    get type(): LeaderboardType {
        return this.#saas ? LEADERBOARD_TYPE.IN_GAME : this._platformBridge.leaderboardsType
    }

    // SaaS request client; set during initialize() when the active platform is
    // configured to use the SaaS (in-game) leaderboards backend.
    #saas: SaasRequest | null = null

    initialize(platformBridge: LeaderboardsBridgeContract): this {
        super.initialize(platformBridge)
        if (this._isSaas(MODULE_NAME.LEADERBOARDS)) {
            this.#saas = new SaasRequest(platformBridge as unknown as SaasBridgeLike)
        }
        return this
    }

    setScore(id: string, score: number): Promise<unknown> {
        if (this.type === LEADERBOARD_TYPE.NOT_AVAILABLE) {
            return Promise.reject()
        }

        if (this.#saas) {
            // Skip the SaaS request when there is no player identity to attribute the score to.
            if (!this._platformBridge.playerId) {
                return Promise.reject()
            }

            return this.#saas.post(`leaderboards/${id}`, { score })
        }

        const modifiedId = this._getPlatformLeaderboardId(id)
        const isMain = this.#getIsMain(id)

        return this._platformBridge.leaderboardsSetScore(modifiedId, score, isMain)
    }

    getEntries(id: string): Promise<LeaderboardEntry[]> {
        if (this.type !== LEADERBOARD_TYPE.IN_GAME) {
            return Promise.reject()
        }

        if (this.#saas) {
            return this.#saas.get<LeaderboardEntry[]>(`leaderboards/${id}`)
        }

        const modifiedId = this._getPlatformLeaderboardId(id)

        return this._platformBridge.leaderboardsGetEntries(modifiedId) as Promise<LeaderboardEntry[]>
    }

    showNativePopup(id: string): Promise<unknown> {
        if (this._platformBridge.leaderboardsType !== LEADERBOARD_TYPE.NATIVE_POPUP) {
            return Promise.reject()
        }

        const modifiedId = this._getPlatformLeaderboardId(id)
        return this._platformBridge.leaderboardsShowNativePopup(modifiedId)
    }

    protected _getPlatformLeaderboardId(id: string | null | undefined): string | null | undefined {
        if (!id) {
            return id
        }

        const { leaderboards } = bridgeConfig.getValues()
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
        const { leaderboards } = bridgeConfig.getValues()
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
