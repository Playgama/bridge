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
import type { StorageType } from '../constants'

export interface StorageBridgeContract extends PlatformBridgeLike {
    defaultStorageType: StorageType
    getDataFromStorage(
        key: string | string[],
        storageType: StorageType,
        tryParseJson: boolean,
    ): Promise<unknown>
    setDataToStorage(
        key: string | string[],
        value: unknown | unknown[],
        storageType: StorageType,
    ): Promise<void>
    deleteDataFromStorage(
        key: string | string[],
        storageType: StorageType,
    ): Promise<void>
}

class StorageModule extends ModuleBase<StorageBridgeContract> {
    get defaultType(): StorageType {
        return this._platformBridge.defaultStorageType
    }

    get(key: string | string[], tryParseJson = true): Promise<unknown> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve([])
        }

        return this._platformBridge.getDataFromStorage(key, this.defaultType, tryParseJson)
    }

    set(key: string | string[], value: unknown | unknown[]): Promise<void> {
        if (Array.isArray(key)) {
            if (!Array.isArray(value)) {
                return Promise.reject(new Error('Value must be an array when key is an array'))
            }
            if (key.length !== value.length) {
                return Promise.reject(new Error('Key and value arrays must have the same length'))
            }
            if (key.length === 0) {
                return Promise.resolve()
            }
        }

        return this._platformBridge.setDataToStorage(key, value, this.defaultType)
    }

    delete(key: string | string[]): Promise<void> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve()
        }

        return this._platformBridge.deleteDataFromStorage(key, this.defaultType)
    }
}

export default StorageModule
