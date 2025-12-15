import { SAAS_URL } from '../constants'
import { LeaderboardService } from './LeaderboardService'

export class SaaS {
    _saasUrl

    _playerModule

    _platformId

    _leaderboardService

    get leaderboardService() {
        return this._leaderboardService
    }

    constructor(playerModule, platformId, options = {}) {
        this._saasUrl = options.saas?.baseUrl || SAAS_URL
        this._playerModule = playerModule
        this._platformId = platformId

        const request = this.createRequest()
        this._leaderboardService = new LeaderboardService(request)
    }

    createRequest() {
        return {
            async get(url, options = {}) {
                return fetch(`${this._saasUrl}/${url}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-player-id': this._playerModule.playerId || '',
                        'x-platform-id': this._platformId,
                        ...options,
                    },
                }).then((response) => response.json())
            },

            async post(url, data, options = {}) {
                return fetch(`${this._saasUrl}/${url}`, {
                    method: 'POST',
                    data: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json',
                        'x-player-id': this._playerModule.playerId || '',
                        'x-platform-id': this._platformId,
                        ...options,
                    },
                }).then((response) => response.json())
            },
        }
    }
}
