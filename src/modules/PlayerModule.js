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

class PlayerModule extends ModuleBase {
    get isAuthorizationSupported() {
        return this._platformBridge.isPlayerAuthorizationSupported
    }

    get isAuthorized() {
        return this._platformBridge.isPlayerAuthorized
    }

    get id() {
        return this._platformBridge.playerId
    }

    get name() {
        return this._platformBridge.playerName
    }

    get photos() {
        return this._platformBridge.playerPhotos
    }

    get extra() {
        return this._platformBridge.playerExtra
    }

    authorize(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.authorize(platformDependedOptions)
            }
        }

        return this._platformBridge.authorizePlayer(options)
    }
}

export default PlayerModule
