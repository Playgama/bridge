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
import { PLATFORM_ID } from './platform/constants'

// Platform bridge contract used by modules. Until PlatformBridgeBase is migrated,
// we rely on the EventEmitter-shaped subset that ModuleBase actually depends on.
export type PlatformBridgeLike = EventEmitter & Record<string, unknown>

class ModuleBase<TPlatformBridge extends PlatformBridgeLike = PlatformBridgeLike> {
    // Assigned during initialize(), which the SDK calls once the platform bridge exists.
    protected _platformBridge!: TPlatformBridge

    // Injects the platform bridge. Subclasses override to add bridge-dependent
    // setup and must call super.initialize(platformBridge) first.
    initialize(platformBridge: TPlatformBridge): this {
        this._platformBridge = platformBridge
        return this
    }

    protected _forwardEvent(eventName: string): void {
        this._platformBridge.on(eventName, (...args: unknown[]) => eventBus.emit(eventName, ...args))
    }

    // Whether the active platform is configured to use the SaaS backend for the
    // given feature. Reusable across modules: a module that supports a SaaS
    // variant calls this in initialize() to pick its implementation.
    protected _isSaas(feature: string): boolean {
        const { options, platformId } = this._platformBridge as {
            options?: { saas?: { publicToken?: string; [key: string]: unknown } }
            platformId?: string
        }
        const saas = options?.saas
        const config = saas?.[feature] as { platforms?: string[] } | undefined
        if (!config) {
            return false
        }

        // On Playgama the feature runs through SaaS as soon as a token is set,
        // without listing the platform explicitly.
        if (platformId === PLATFORM_ID.PLAYGAMA && saas?.publicToken) {
            return true
        }

        return Boolean(
            Array.isArray(config.platforms)
            && platformId != null
            && config.platforms.includes(platformId),
        )
    }
}

export default ModuleBase
