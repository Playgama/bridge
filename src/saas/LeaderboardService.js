import { ServiceBase } from './ServiceBase'

export class LeaderboardService extends ServiceBase {
    async setScore(board, score) {
        return this._request.post('leaderboards', { board, score })
    }

    async getEntries(board) {
        return this._request.get(`leaderboards?board=${board}`)
    }
}
