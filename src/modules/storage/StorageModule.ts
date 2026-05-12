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

import ModuleBase from '../ModuleBase'
import { EVENT_NAME } from '../../constants'
import {
    CLOUD_STORAGE_MODE,
    STORAGE_TYPE,
    type StorageType,
} from './constants'
import LocalStorageStrategy from './LocalStorageStrategy'
import PlatformStorageStrategy from './PlatformStorageStrategy'
import type { StorageBridgeContract } from './types'

class StorageModule extends ModuleBase<StorageBridgeContract> {
    get defaultType(): StorageType {
        return this._platformBridge.defaultStorageType
    }

    #localStrategy: LocalStorageStrategy

    #platformStrategy: PlatformStorageStrategy

    constructor(platformBridge: StorageBridgeContract) {
        super(platformBridge)

        this.#localStrategy = new LocalStorageStrategy(platformBridge)
        this.#platformStrategy = new PlatformStorageStrategy(platformBridge, this.#localStrategy)

        this._platformBridge.on(EVENT_NAME.DEFAULT_STORAGE_TYPE_CHANGED, () => {
            this.#platformStrategy.reset()
        })
    }

    get(key: string | string[], tryParseJson = true): Promise<unknown> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve([])
        }

        if (this.#useLocal()) {
            return this.#localStrategy.read(key, tryParseJson)
        }

        return this.#platformStrategy.read(key, tryParseJson, this._platformBridge.cloudStorageMode)
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

        if (this.#useLocal()) {
            return this.#localStrategy.write(key, value)
        }

        return this.#platformStrategy.write(key, value, this._platformBridge.cloudStorageMode)
    }

    delete(key: string | string[]): Promise<void> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve()
        }

        if (this.#useLocal()) {
            return this.#localStrategy.delete(key)
        }

        return this.#platformStrategy.delete(key, this._platformBridge.cloudStorageMode)
    }

    #useLocal(): boolean {
        const storageType = this.defaultType
        const cloudMode = this._platformBridge.cloudStorageMode
        return storageType === STORAGE_TYPE.LOCAL_STORAGE || cloudMode === CLOUD_STORAGE_MODE.NONE
    }
}

export default StorageModule
