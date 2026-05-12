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

import { ERROR } from '../../constants'
import { parseValue, serializeValue } from './helpers'
import type { StorageBridgeContract } from './types'

class LocalStorageStrategy {
    get storage(): Storage | null {
        return this.#bridge._localStorage
    }

    #bridge: StorageBridgeContract

    constructor(bridge: StorageBridgeContract) {
        this.#bridge = bridge
    }

    read(key: string | string[], tryParseJson: boolean): Promise<unknown> {
        const localStorage = this.storage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (Array.isArray(key)) {
            const values = key.map((k) => parseValue(localStorage.getItem(k), tryParseJson))
            return Promise.resolve(values)
        }

        return Promise.resolve(parseValue(localStorage.getItem(key), tryParseJson))
    }

    write(key: string | string[], value: unknown | unknown[]): Promise<void> {
        const localStorage = this.storage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        try {
            if (Array.isArray(key)) {
                const values = value as unknown[]
                for (let i = 0; i < key.length; i++) {
                    localStorage.setItem(key[i], serializeValue(values[i]) as string)
                }
            } else {
                localStorage.setItem(key, serializeValue(value) as string)
            }
            return Promise.resolve()
        } catch (error) {
            if (error && (error as Error).name === 'QuotaExceededError') {
                return Promise.reject(ERROR.STORAGE_QUOTA_EXCEEDED)
            }
            return Promise.reject(error)
        }
    }

    delete(key: string | string[]): Promise<void> {
        const localStorage = this.storage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (Array.isArray(key)) {
            key.forEach((k) => localStorage.removeItem(k))
        } else {
            localStorage.removeItem(key)
        }
        return Promise.resolve()
    }

    removeMany(keys: string[]): void {
        const localStorage = this.storage
        if (!localStorage) {
            return
        }
        keys.forEach((k) => localStorage.removeItem(k))
    }
}

export default LocalStorageStrategy
