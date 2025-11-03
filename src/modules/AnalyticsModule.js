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

import { PLATFORM_ID } from '../constants'
import { version } from '../../package.json'
import ModuleBase from './ModuleBase'

const API_URL = 'https://playgama.com/api/v1/events'
const DISCORD_API_URL = '/playgama/api/v1/events'
const BATCH_TIMEOUT = 3000

class AnalyticsModule extends ModuleBase {
    #eventQueue = []

    #batchTimer = null

    #gameId = null

    #createTimestamp = new Date().toISOString()

    initialize(platformBridge) {
        this._platformBridge = platformBridge
        this.#gameId = this.#extractGameId()

        const event = {
            type: 'initialization_started',
            bridge_version: version,
            platform_id: this._platformBridge.platformId,
            game_id: this.#gameId,
            timestamp: this.#createTimestamp,
            data: {},
        }
        this.#eventQueue.push(event)

        return this
    }

    send(eventType, eventData = {}) {
        const sendAnalyticsEvents = this._platformBridge.options?.sendAnalyticsEvents
        if (sendAnalyticsEvents === false) {
            return
        }

        const { href } = window.location
        if (href.startsWith('file://') || href.includes('localhost') || href.includes('127.0.0.1')) {
            return
        }

        const event = {
            type: eventType,
            bridge_version: version,
            platform_id: this._platformBridge.platformId,
            game_id: this.#gameId,
            timestamp: new Date().toISOString(),
            data: eventData,
        }

        this.#eventQueue.push(event)

        if (this.#batchTimer) {
            clearTimeout(this.#batchTimer)
        }

        this.#batchTimer = setTimeout(() => {
            this.#flush()
        }, BATCH_TIMEOUT)
    }

    #flush() {
        if (this.#eventQueue.length === 0) {
            return
        }

        const events = [...this.#eventQueue]
        this.#eventQueue = []
        this.#batchTimer = null

        let url = API_URL
        if (this._platformBridge.platformId === PLATFORM_ID.DISCORD) {
            url = DISCORD_API_URL
        }

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status}`)
                }
            })
            .catch((error) => {
                console.error('Error sending analytics events:', error)
            })
    }

    #extractGameId() {
        const { options } = this._platformBridge
        let gameId

        switch (this._platformBridge.platformId) {
            case PLATFORM_ID.GAME_DISTRIBUTION:
                gameId = options.gameId
                break
            case PLATFORM_ID.Y8:
                gameId = options.gameId
                break
            case PLATFORM_ID.HUAWEI:
                gameId = options.appId
                break
            case PLATFORM_ID.MSN:
                gameId = options.gameId
                break
            case PLATFORM_ID.DISCORD:
                gameId = options.appId
                break
            case PLATFORM_ID.GAMEPUSH:
                gameId = options.projectId
                break
            default:
                gameId = null
                break
        }

        if (!gameId) {
            gameId = this.#getGameIdFromUrl(window.location.href)
        }

        return gameId
    }

    #getGameIdFromUrl(url) {
        try {
            const parsedUrl = new URL(url)
            const parts = parsedUrl.pathname.split('/').filter(Boolean)

            switch (this._platformBridge.platformId) {
                case PLATFORM_ID.YANDEX: {
                    const i = parts.indexOf('app')
                    const id = i !== -1 ? parts[i + 1] : null
                    if (id) {
                        return `Yandex ${id}`
                    }
                    break
                }

                case PLATFORM_ID.LAGGED: {
                    const i = parts.indexOf('g')
                    const slug = i !== -1 ? parts[i + 1] : null
                    if (slug) {
                        return this.#formatGameName(slug)
                    }
                    break
                }

                case PLATFORM_ID.CRAZY_GAMES: {
                    const i = parts.indexOf('game')
                    const slug = i !== -1 ? parts[i + 1] : null
                    if (slug) {
                        return this.#formatGameName(slug)
                    }
                    break
                }

                case PLATFORM_ID.PLAYGAMA: {
                    const i = parts.indexOf('game')
                    const slug = i !== -1 ? parts[i + 1] : null
                    if (slug) {
                        return this.#formatGameName(slug)
                    }
                    const id = parts[0]
                    const isInternalId = typeof id === 'string' && /^[a-z0-9]{10,}$/i.test(id)
                    if (isInternalId) {
                        return `Playgama ${id}`
                    }
                    break
                }
                default:
                    break
            }
        } catch (err) {
            return null
        }
        return null
    }

    #formatGameName(name) {
        if (typeof name !== 'string' || name.length === 0) {
            return ''
        }
        return name
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
    }
}

export default new AnalyticsModule()
