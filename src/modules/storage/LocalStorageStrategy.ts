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

import { BridgeError, ERROR_CODE } from '../../constants'
import localStorage from '../../lib/LocalStorage'
import { parseValue, serializeValue } from './helpers'

class LocalStorageStrategy {
    get isAvailable(): boolean {
        return localStorage.isAvailable
    }

    read(key: string | string[], tryParseJson: boolean): Promise<unknown> {
        if (!localStorage.isAvailable) {
            return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
        }

        if (Array.isArray(key)) {
            const values = key.map((k) => parseValue(localStorage.getItem(k), tryParseJson))
            return Promise.resolve(values)
        }

        return Promise.resolve(parseValue(localStorage.getItem(key), tryParseJson))
    }

    write(key: string | string[], value: unknown | unknown[]): Promise<void> {
        if (!localStorage.isAvailable) {
            return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
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
                return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_QUOTA_EXCEEDED))
            }
            return Promise.reject(error)
        }
    }

    delete(key: string | string[]): Promise<void> {
        if (!localStorage.isAvailable) {
            return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
        }

        if (Array.isArray(key)) {
            key.forEach((k) => localStorage.removeItem(k))
        } else {
            localStorage.removeItem(key)
        }
        return Promise.resolve()
    }

    removeMany(keys: string[]): void {
        if (!localStorage.isAvailable) {
            return
        }
        keys.forEach((k) => localStorage.removeItem(k))
    }
}

export default LocalStorageStrategy
