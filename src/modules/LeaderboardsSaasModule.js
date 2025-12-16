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

import LeaderboardsModule from './LeaderboardsModule'

class LeaderboardsSaasModule extends LeaderboardsModule {
    async setScore(leaderboardId, score) {
        const saasLeaderboardId = this._getPlatformLeaderboardId(leaderboardId)

        return this.request.post(`leaderboards/${saasLeaderboardId}/entries`, { score })
    }

    async getEntries(leaderboardId) {
        const saasLeaderboardId = this._getPlatformLeaderboardId(leaderboardId)

        return this.request.get(`leaderboards/${saasLeaderboardId}/entries`)
    }
}

export default LeaderboardsSaasModule
