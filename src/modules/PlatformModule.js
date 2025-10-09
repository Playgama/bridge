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

import EventLite from 'event-lite'
import ModuleBase from './ModuleBase'
import { EVENT_NAME, PLATFORM_ID, PLATFORM_MESSAGE } from '../constants'
import { version } from '../../package.json'

class PlatformModule extends ModuleBase {
    get id() {
        return this._platformBridge.platformId
    }

    get sdk() {
        return this._platformBridge.platformSdk
    }

    get language() {
        return this._platformBridge.platformLanguage
    }

    get payload() {
        return this._platformBridge.platformPayload
    }

    get tld() {
        return this._platformBridge.platformTld
    }

    get isGetAllGamesSupported() {
        return this._platformBridge.isPlatformGetAllGamesSupported
    }

    get isGetGameByIdSupported() {
        return this._platformBridge.isPlatformGetGameByIdSupported
    }

    get isAudioEnabled() {
        return this._platformBridge.isPlatformAudioEnabled
    }

    get isPaused() {
        return this._platformBridge.isPlatformPaused
    }

    #isGameReadyMessageSent = false

    constructor(platformBridge) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.AUDIO_STATE_CHANGED,
            (isEnabled) => this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled),
        )

        this._platformBridge.on(
            EVENT_NAME.PAUSE_STATE_CHANGED,
            (isPaused) => this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, isPaused),
        )
    }

    sendMessage(message) {
        if (message === PLATFORM_MESSAGE.GAME_READY) {
            if (this.#isGameReadyMessageSent) {
                return Promise.reject()
            }

            this.#isGameReadyMessageSent = true
            this.#trySendAnalyticsEvent()
            const overlay = document.getElementById('loading-overlay')
            if (overlay) {
                overlay.remove()
            }
        }

        return this._platformBridge.sendMessage(message)
    }

    getServerTime() {
        return this._platformBridge.getServerTime()
    }

    getAllGames() {
        return this._platformBridge.getAllGames()
    }

    getGameById(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.getGameById(platformDependedOptions)
            }
        }

        return this._platformBridge.getGameById(options)
    }

    #trySendAnalyticsEvent() {
        const sendAnalyticsEvents = this._platformBridge.options?.sendAnalyticsEvents
        const { href } = window.location
        if (href.startsWith('file://') || href.includes('localhost') || href.includes('127.0.0.1')) {
            return
        }

        if (sendAnalyticsEvents !== false) {
            let url = 'https://playgama.com/api/v1/events'
            if (this._platformBridge.platformId === 'discord') {
                url = '/playgama/api/v1/events'
            }
            const { options } = this._platformBridge
            let gameName = null

            switch (this._platformBridge.platformId) {
                case PLATFORM_ID.GAME_DISTRIBUTION:
                    gameName = options.gameId
                    break
                case PLATFORM_ID.Y8:
                    gameName = options.gameId
                    break
                case PLATFORM_ID.HUAWEI:
                    gameName = options.appId
                    break
                case PLATFORM_ID.MSN:
                    gameName = options.gameId
                    break
                case PLATFORM_ID.DISCORD:
                    gameName = options.appId
                    break
                case PLATFORM_ID.GAMEPUSH:
                    gameName = options.projectId
                    break
                default:
                    gameName = null
                    break
            }

            if (!gameName) {
                gameName = this.#getGameName(window.location.href)
            }

            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventName: 'game_ready',
                    pageName: `${this._platformBridge.platformId}:${this._platformBridge.engine}`,
                    userId: `bridge:${version}`,
                    clid: gameName,
                }),
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.status}`)
                    }
                })
                .catch((error) => {
                    console.error('Error sending event:', error)
                })
        }
    }

    #getGameName(url) {
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

EventLite.mixin(PlatformModule.prototype)
export default PlatformModule
