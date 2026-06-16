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

import ModuleBase, { type PlatformBridgeLike } from '../ModuleBase'

// Dynamic game/player parameters set during gameplay and forwarded to the
// platform SDK for config segmentation (e.g. Yandex clientFeatures).
export type RemoteConfigDynamicParameters = Record<string, string | number | boolean>

export interface RemoteConfigBridgeContract extends PlatformBridgeLike {
    isRemoteConfigSupported: boolean
    getRemoteConfig(parameters?: RemoteConfigDynamicParameters): Promise<unknown>
}

class RemoteConfigModule extends ModuleBase<RemoteConfigBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isRemoteConfigSupported
    }

    // Dynamic parameters set during gameplay, forwarded to the platform SDK on
    // every get().
    #dynamicParameters: RemoteConfigDynamicParameters = {}

    // Sets dynamic game/player parameters used for config segmentation.
    // Accumulates across calls; only used by platforms that support it.
    setDynamicParameters(parameters: RemoteConfigDynamicParameters): void {
        this.#dynamicParameters = { ...this.#dynamicParameters, ...parameters }
    }

    get(): Promise<unknown> {
        return this._platformBridge.getRemoteConfig(this.#dynamicParameters)
    }
}

export default RemoteConfigModule
