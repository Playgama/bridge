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

import ModuleBase from './ModuleBase'
import { PLATFORM_MESSAGE } from '../constants'

class PlatformModule extends ModuleBase {
    #isGameReadyMessageSent = false

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

export default PlatformModule
