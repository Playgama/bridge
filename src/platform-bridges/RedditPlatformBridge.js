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

            this._platformSdk = window.reddit
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
            if (Array.isArray(key)) {
                const promises = key.map((k) => this._platformSdk.storage.get(k, 'platform_internal').then((rawValue) => {
                    let parsedValue = rawValue

                    if (tryParseJson && typeof rawValue === 'string') {
                        try {
                            parsedValue = JSON.parse(rawValue)
                        } catch (e) {
                            // keep parsedValue as-is
                        }
                    }

                    return parsedValue
                }))

                return Promise.all(promises)
            }

            return this._platformSdk.storage.get(key, 'platform_internal').then((rawValue) => {
                let parsedValue = rawValue

                if (tryParseJson && typeof rawValue === 'string') {
                    try {
                        parsedValue = JSON.parse(rawValue)
                    } catch (e) {
                        // keep parsedValue as-is
                    }
                }

                return parsedValue
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    async setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                if (!Array.isArray(value)) {
                    throw new Error('Value must be an array if key is an array')
                }

                if (key.length !== value.length) {
                    throw new Error('Key and value arrays must have the same length')
                }

                await this._platformSdk.storage.set(key, value, 'platform_internal')
                return
            }

            await this._platformSdk.storage.set(key, value, 'platform_internal')
            return
        }

        await super.setDataToStorage(key, value, storageType)
    }

    async deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                /* eslint-disable no-await-in-loop */
                for (let i = 0; i < key.length; i++) {
                    await this._platformSdk.storage.delete(key[i], 'platform_internal')
                }
                /* eslint-enable no-await-in-loop */

                return
            }

            await this._platformSdk.storage.delete(key, 'platform_internal')
            return
        }

        await super.deleteDataFromStorage(key, storageType)
    }
}

export default RedditPlatformBridge
