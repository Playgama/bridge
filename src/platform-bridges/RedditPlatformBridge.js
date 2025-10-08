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

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            window.addEventListener('message', (event) => {
                if (event.data.type === 'devvit-message') {
                    const { message } = event.data.data
                    if (message.type === ACTION_NAME.INITIALIZE) {
                        this.#handleInitilize()
                    } else if (message.type === ACTION_NAME.GET_STORAGE_DATA) {
                        this.#handleGetStorage(message)
                    } else if (message.type === ACTION_NAME.SET_STORAGE_DATA) {
                        this.#handleSetStorage(message)
                    } else if (message.type === ACTION_NAME.DELETE_STORAGE_DATA) {
                        this.#handleDeleteStorage(message)
                    }
                }
            })

            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.#postMessage(ACTION_NAME.INITIALIZE)
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
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)

                this.#postMessage(ACTION_NAME.GET_STORAGE_DATA, { key })
            }

            return promiseDecorator.promise
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    async setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)

                this.#postMessage(ACTION_NAME.SET_STORAGE_DATA, { key, value })
            }

            return promiseDecorator.promise
        }

        return super.setDataToStorage(key, value, storageType)
    }

    async deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)

                this.#postMessage(ACTION_NAME.DELETE_STORAGE_DATA, { key })
            }

            return promiseDecorator.promise
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    async #postMessage(type, data = {}) {
        window.parent.postMessage({
            type,
            data,
        }, '*')
    }

    #handleInitilize() {
        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
    }

    #handleGetStorage(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, message.data.data ?? null)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        }
    }

    #handleSetStorage(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        }
    }

    #handleDeleteStorage(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        }
    }
}

export default RedditPlatformBridge
