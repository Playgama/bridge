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
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const promises = key.map((singleKey) => this.#storageGet(singleKey).then((rawValue) => {
                    if (tryParseJson && typeof rawValue === 'string') {
                        try {
                            return JSON.parse(rawValue)
                        } catch (error) {
                            return rawValue
                        }
                    }
                    return rawValue
                }))

                return Promise.all(promises)
            }

            return this.#storageGet(key).then((rawValue) => {
                if (tryParseJson && typeof rawValue === 'string') {
                    try {
                        return JSON.parse(rawValue)
                    } catch (error) {
                        return rawValue
                    }
                }
                return rawValue
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

                await Promise.all(key.map((singleKey, index) => this.#storageSet(singleKey, value[index])))
                return
            }

            await this.#storageSet(key, value)
            return
        }

        await super.setDataToStorage(key, value, storageType)
    }

    async deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const deletePromises = key.map((singleKey) => this.#storageDelete(singleKey))
                await Promise.all(deletePromises)
                return
            }

            await this.#storageDelete(key)
            return
        }

        await super.deleteDataFromStorage(key, storageType)
    }

    async #postJSON(path, body) {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
    }

    async #storageGet(key) {
        const result = await this.#postJSON('/api/storage/get', { key })
        return result.data ?? null
    }

    async #storageSet(key, value) {
        await this.#postJSON('/api/storage/set', { key, value })
    }

    async #storageDelete(key) {
        await this.#postJSON('/api/storage/delete', { key })
    }
}

export default RedditPlatformBridge
