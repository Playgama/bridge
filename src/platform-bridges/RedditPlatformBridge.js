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
                        this.#handleInitialize(message)
                    } else if (message.type === ACTION_NAME.GET_STORAGE_DATA) {
                        this.#handleGetStorage(message)
                    } else if (message.type === ACTION_NAME.SET_STORAGE_DATA) {
                        this.#handleSetStorage(message)
                    } else if (message.type === ACTION_NAME.DELETE_STORAGE_DATA) {
                        this.#handleDeleteStorage(message)
                    } else if (message.type === ACTION_NAME.GET_CATALOG) {
                        this.#handleGetCatalog(message)
                    } else if (message.type === ACTION_NAME.PURCHASE) {
                        this.#handlePurchase(message)
                    } else if (message.type === ACTION_NAME.GET_PURCHASES) {
                        this.#handleGetPurchases(message)
                    } else if (message.type === ACTION_NAME.CREATE_POST) {
                        this.#handleCreatePost(message)
                    } else if (message.type === ACTION_NAME.JOIN_COMMUNITY) {
                        this.#handleJoinCommunity()
                    }
                }
            })

            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.#postMessage(ACTION_NAME.INITIALIZE)
        }

        return promiseDecorator.promise
    }

    // storage
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

    // payments
    paymentsPurchase(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#postMessage(ACTION_NAME.PURCHASE, { id })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()

        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#postMessage(ACTION_NAME.GET_CATALOG)
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    // social
    createPost(options = {}) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#postMessage(ACTION_NAME.CREATE_POST, { options })
        }

        return promiseDecorator.promise
    }

    joinCommunity() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this.#postMessage(ACTION_NAME.JOIN_COMMUNITY)
        }

        return promiseDecorator.promise
    }

    #postMessage(type, data = {}) {
        window.parent.postMessage({ type, data }, '*')
    }

    #handleInitialize(message) {
        this._isPlayerAuthorized = message.isPlayerAuthorized

        if (this._isPlayerAuthorized) {
            this._playerId = message.playerId
            this._playerName = message.playerName
            if (message.playerPhoto) {
                this._playerPhotos.push(message.playerPhoto)
            }
        }

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

    #handlePurchase(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, message.data)
        }
    }

    #handleGetCatalog(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, message.data)
        }
    }

    #handleGetPurchases(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, message.data)
        }
    }

    #handleCreatePost(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.CREATE_POST)
        }
    }

    #handleJoinCommunity(message) {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        }
    }
}

export default RedditPlatformBridge
