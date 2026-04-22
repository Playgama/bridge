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

import ModuleBase from './ModuleBase'

class StorageModule extends ModuleBase {
    get defaultType() {
        return this._platformBridge.defaultStorageType
    }

    get(key, tryParseJson = true) {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve([])
        }

        return this._platformBridge.getDataFromStorage(key, this.defaultType, tryParseJson)
    }

    set(key, value) {
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

    delete(key) {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve()
        }

        return this._platformBridge.deleteDataFromStorage(key, this.defaultType)
    }
}

export default StorageModule
