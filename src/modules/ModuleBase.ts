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

import eventBus, { type EventEmitter } from '../lib/EventBus'
import bridgeConfig, { type SaasFeatureConfig } from '../lib/bridge-config'
import { PLAYGAMA_PLATFORM_IDS, type PlatformId } from './platform/constants'

export type PlatformBridgeLike = EventEmitter & Record<string, unknown>

class ModuleBase<TPlatformBridge extends PlatformBridgeLike = PlatformBridgeLike> {
    protected _platformBridge!: TPlatformBridge

    initialize(platformBridge: TPlatformBridge): this {
        this._platformBridge = platformBridge
        return this
    }

    protected _forwardEvent(eventName: string): void {
        this._platformBridge.on(eventName, (...args: unknown[]) => eventBus.emit(eventName, ...args))
    }

    protected _isSaas(feature: string): boolean {
        const platformId = this._platformBridge.platformId as PlatformId | undefined
        const { saas } = bridgeConfig.getValues()

        if (platformId != null && PLAYGAMA_PLATFORM_IDS.includes(platformId) && saas?.publicToken) {
            return true
        }

        const config = saas?.[feature] as SaasFeatureConfig | undefined

        return Boolean(
            config
            && Array.isArray(config.platforms)
            && platformId != null
            && config.platforms.includes(platformId),
        )
    }
}

export default ModuleBase
