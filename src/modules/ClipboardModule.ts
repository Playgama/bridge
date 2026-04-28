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

export interface ClipboardBridgeContract extends PlatformBridgeLike {
    isClipboardSupported: boolean
    clipboardRead(): Promise<string>
    clipboardWrite(text: string): Promise<void>
}

class ClipboardModule extends ModuleBase<ClipboardBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isClipboardSupported
    }

    read(): Promise<string> {
        return this._platformBridge.clipboardRead()
    }

    write(text: string): Promise<void> {
        return this._platformBridge.clipboardWrite(text)
    }
}

export default ClipboardModule
