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

import eventBus from '../common/EventBus'
import type { EventEmitter } from '../types/common'

// Platform bridge contract used by modules. Until PlatformBridgeBase is migrated,
// we rely on the EventEmitter-shaped subset that ModuleBase actually depends on.
export type PlatformBridgeLike = EventEmitter & Record<string, unknown>

class ModuleBase<TPlatformBridge extends PlatformBridgeLike = PlatformBridgeLike> {
    protected _platformBridge: TPlatformBridge

    constructor(platformBridge: TPlatformBridge) {
        this._platformBridge = platformBridge
    }

    protected _forwardEvent(eventName: string): void {
        this._platformBridge.on(eventName, (...args: unknown[]) => eventBus.emit(eventName, ...args))
    }
}

export default ModuleBase
