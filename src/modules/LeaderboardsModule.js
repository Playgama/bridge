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

import ModuleBase from './ModuleBase'

class LeaderboardsModule extends ModuleBase {
    get type() {
        return this._platformBridge.leaderboardsType
    }

    setScore(id, score) {
        const modifiedId = this.#getPlatformLeaderboardId(id)
        return this._platformBridge.leaderboardsSetScore(modifiedId, score)
    }

    getEntries(id) {
        const modifiedId = this.#getPlatformLeaderboardId(id)
        return this._platformBridge.leaderboardsGetEntries(modifiedId)
    }

    #getPlatformLeaderboardId(id) {
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

        if (leaderboard[this._platformBridge.platformId]) {
            return leaderboard[this._platformBridge.platformId]
        }

        return id
    }
}

export default LeaderboardsModule
