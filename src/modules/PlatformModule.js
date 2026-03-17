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
import { EVENT_NAME, MODULE_NAME, PLATFORM_MESSAGE } from '../constants'
import analyticsModule from './AnalyticsModule'

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

    #startTime = performance.now()

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

    sendMessage(message, options = {}) {
        const analyticsData = {}

        if (message === PLATFORM_MESSAGE.GAME_READY) {
            if (this.#isGameReadyMessageSent) {
                return Promise.reject()
            }

            this.#isGameReadyMessageSent = true

            const endTime = performance.now()
            const timeInSeconds = ((endTime - this.#startTime) / 1000).toFixed(2)
            analyticsData.time_s = timeInSeconds

            const overlay = document.getElementById('loading-overlay')
            if (overlay) {
                overlay.remove()
            }
        }

        if (options.world !== undefined) {
            analyticsData.world = String(options.world)
        }

        if (options.level !== undefined) {
            analyticsData.level = String(options.level)
        }

        analyticsModule.send(`${MODULE_NAME.PLATFORM}_message_${message}`, analyticsData)

        this._platformBridge.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, message)

        return this._platformBridge.sendMessage(message, options)
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
}

EventLite.mixin(PlatformModule.prototype)
export default PlatformModule
