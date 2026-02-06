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

import { LEADERBOARD_TYPE } from '../constants'
import LeaderboardsModule from './LeaderboardsModule'
import SaasRequestMixin from './mixins/SaasRequestMixin'

class LeaderboardsSaasModule extends SaasRequestMixin(LeaderboardsModule) {
    get type() {
        return LEADERBOARD_TYPE.IN_GAME
    }

    async setScore(leaderboardId, score) {
        return this.request.post(`leaderboards/${leaderboardId}`, { score })
    }

    async getEntries(leaderboardId) {
        return this.request.get(`leaderboards/${leaderboardId}`)
    }
}

export default LeaderboardsSaasModule
