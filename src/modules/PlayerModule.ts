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

import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import type { PlatformId } from '../constants'
import type { AnyRecord } from '../types/common'

export type PlayerAuthorizeOptions = AnyRecord & Partial<Record<PlatformId, AnyRecord>>

export interface PlayerBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isPlayerAuthorizationSupported: boolean
    isPlayerAuthorized: boolean
    playerId: string | null
    playerName: string | null
    playerPhotos: string[]
    playerExtra: AnyRecord
    authorizePlayer(options?: PlayerAuthorizeOptions): Promise<unknown>
}

class PlayerModule extends ModuleBase<PlayerBridgeContract> {
    get isAuthorizationSupported(): boolean {
        return this._platformBridge.isPlayerAuthorizationSupported
    }

    get isAuthorized(): boolean {
        return this._platformBridge.isPlayerAuthorized
    }

    get id(): string | null {
        return this._platformBridge.playerId
    }

    get name(): string | null {
        return this._platformBridge.playerName
    }

    get photos(): string[] {
        return this._platformBridge.playerPhotos
    }

    get extra(): AnyRecord {
        return this._platformBridge.playerExtra
    }

    authorize(options?: PlayerAuthorizeOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.authorize(platformDependedOptions as PlayerAuthorizeOptions)
            }
        }

        if (!this.isAuthorizationSupported) {
            return Promise.reject()
        }

        return this._platformBridge.authorizePlayer(options)
    }
}

export default PlayerModule
