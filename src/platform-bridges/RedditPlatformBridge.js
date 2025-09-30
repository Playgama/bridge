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

import PlatformBridgeBase from './PlatformBridgeBase'
import { ACTION_NAME, PLATFORM_ID, STORAGE_TYPE } from '../constants'

class RedditPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.REDDIT
    }

    get isPaymentsSupported() {
        return true
    }

    get isJoinCommunitySupported() {
        return true
    }

    get isShareSupported() {
        return true
    }

    get isCreatePostSupported() {
        return true
    }

    get isAddToHomeScreenSupported() {
        return false
    }

    get isAddToFavoritesSupported() {
        return false
    }

    get isRateSupported() {
        return false
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this._isInitialized = true
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
        }

        return promiseDecorator.promise
    }

    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._localStorage !== null
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._localStorage !== null
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._localStorage) {
                return Promise.reject()
            }

            if (Array.isArray(key)) {
                const values = []
                for (let i = 0; i < key.length; i++) {
                    values.push(this._getDataFromLocalStorage(key[i], tryParseJson))
                }
                return Promise.resolve(values)
            }

            const value = this._getDataFromLocalStorage(key, tryParseJson)
            return Promise.resolve(value)
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._localStorage) {
                return Promise.reject()
            }

            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    this._setDataToLocalStorage(key[i], value[i])
                }
                return Promise.resolve()
            }

            this._setDataToLocalStorage(key, value)
            return Promise.resolve()
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._localStorage) {
                return Promise.reject()
            }

            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    this._deleteDataFromLocalStorage(key[i])
                }
                return Promise.resolve()
            }

            this._deleteDataFromLocalStorage(key)
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }
}

export default RedditPlatformBridge
