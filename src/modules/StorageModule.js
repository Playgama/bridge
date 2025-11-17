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

    isSupported(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.isSupported(platformDependedOptions)
            }
        }

        return this._platformBridge.isStorageSupported(options)
    }

    isAvailable(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.isSupported(platformDependedOptions)
            }
        }

        return this._platformBridge.isStorageAvailable(options)
    }

    get(key, options, tryParseJson = true) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.get(key, platformDependedOptions, tryParseJson)
            }
        }

        let storageType = options
        if (!storageType) {
            storageType = this.defaultType
        }

        if (!this._platformBridge.isStorageAvailable(storageType)) {
            return Promise.reject()
        }

        // Validate array input
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve([])
        }

        return this._platformBridge.getDataFromStorage(key, storageType, tryParseJson)
    }

    set(key, value, options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.set(key, value, platformDependedOptions)
            }
        }

        let storageType = options
        if (!storageType) {
            storageType = this.defaultType
        }

        if (!this._platformBridge.isStorageAvailable(storageType)) {
            return Promise.reject()
        }

        // Validate array inputs
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

        return this._platformBridge.setDataToStorage(key, value, storageType)
    }

    delete(key, options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.delete(key, platformDependedOptions)
            }
        }

        let storageType = options
        if (!storageType) {
            storageType = this.defaultType
        }

        if (!this._platformBridge.isStorageAvailable(storageType)) {
            return Promise.reject()
        }

        // Validate array input
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve()
        }

        return this._platformBridge.deleteDataFromStorage(key, storageType)
    }
}

export default StorageModule
