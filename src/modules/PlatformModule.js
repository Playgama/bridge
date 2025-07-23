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
}

EventLite.mixin(PlatformModule.prototype)
export default PlatformModule
