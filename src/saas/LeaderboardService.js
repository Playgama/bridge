import { ServiceBase } from './ServiceBase'

export class LeaderboardService extends ServiceBase {
    async setScore(leaderboardId, score) {
        return this._request.post('leaderboards', { leaderboardId, score })
    }

    async getEntries(leaderboardId) {
        return this._request.get(`leaderboards?leaderboardId=${leaderboardId}`)
    }
}
