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
import { EVENT_NAME, PLATFORM_MESSAGE } from '../constants'
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
            this.#sendAnalyticsEvent()
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

    #sendAnalyticsEvent() {
        // if (this._platformBridge?.options) {
        //     console.info('PlatformBridge options:', this._platformBridge.options)
        //     if (this._platformBridge.options.events !== false) {
        //         console.info('events are enabled for current platform')
        //     } else {
        //         console.info('events are disabled for current platform')
        //     }
        // } else {
        //     console.info('PlatformBridge options do not exist')
        // }

        const events = this._platformBridge.options?.events
        if (events !== false) {
            console.info(events === true ? 'events enabled' : 'events not defined, enabled by default')
        }

        console.info('Event payload details:')
        console.info('  eventName:', 'game_ready')
        console.info('  pageName:', `${this._platformBridge.platformId}:${this._platformBridge.engine}`)
        console.info('  userId:', `bridge:${version}`)
        console.info('  clid:', window.location.href)

        fetch('https://playgama.com/api/v1/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventName: 'game_ready',
                pageName: `${this._platformBridge.platformId}:${this._platformBridge.engine}`,
                userId: `bridge:${version}`,
                clid: window.location.href,
            }),
        })
            .then((response) => {
                console.info('Response status:', response.status)
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status}`)
                }
            })
            .catch((error) => {
                console.error('Error sending event:', error)
            })
    }
}

EventLite.mixin(PlatformModule.prototype)
export default PlatformModule
