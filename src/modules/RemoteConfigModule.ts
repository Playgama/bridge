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

export type RemoteConfigOptions = AnyRecord & Partial<Record<PlatformId, AnyRecord>>

export interface RemoteConfigBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isRemoteConfigSupported: boolean
    getRemoteConfig(options?: RemoteConfigOptions): Promise<unknown>
}

class RemoteConfigModule extends ModuleBase<RemoteConfigBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isRemoteConfigSupported
    }

    get(options?: RemoteConfigOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.get(platformDependedOptions as RemoteConfigOptions)
            }
        }
        return this._platformBridge.getRemoteConfig(options)
    }
}

export default RemoteConfigModule
