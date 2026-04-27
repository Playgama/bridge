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
    // platform
    get platformId() {
        return PLATFORM_ID.REDDIT
    }

    // social
    get isJoinCommunitySupported() {
        return true
    }

    get isCreatePostSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.#fetchJson('/api/initialize')
                .then((data) => {
                    const payload = data || {}
                    this._isPlayerAuthorized = !!payload.isPlayerAuthorized

                    if (this._isPlayerAuthorized) {
                        this._playerId = payload.playerId
                        this._playerName = payload.playerName
                        if (payload.playerPhoto) {
                            this._playerPhotos.push(payload.playerPhoto)
                        }
                        this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                    }

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                })
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
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)

                this.#fetchJson('/api/storage/get', { method: 'POST', body: { key } })
                    .then((data) => {
                        this._resolvePromiseDecorator(
                            ACTION_NAME.GET_STORAGE_DATA,
                            data === undefined ? null : data,
                        )
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, error)
                    })
            }

            return promiseDecorator.promise
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)

                this.#fetchJson('/api/storage/set', { method: 'POST', body: { key, value } })
                    .then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA, error)
                    })
            }

            return promiseDecorator.promise
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
            if (!promiseDecorator) {
                promiseDecorator = this._createPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)

                this.#fetchJson('/api/storage/delete', { method: 'POST', body: { key } })
                    .then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA, error)
                    })
            }

            return promiseDecorator.promise
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    checkAdBlock() {
        return Promise.resolve(false)
    }

    // payments
    paymentsPurchase(id) {
        const purchaseFn = typeof window !== 'undefined' && window.__playgama_devvit
            ? window.__playgama_devvit.purchase
            : null

        if (typeof purchaseFn !== 'function') {
            return Promise.reject(new Error(
                'window.__playgama_devvit.purchase is not registered. '
                + 'Set window.__playgama_devvit = { purchase } using purchase() from '
                + '@devvit/web/client before calling bridge.initialize().',
            ))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            Promise.resolve(purchaseFn(id))
                .then((result) => {
                    const purchase = result && typeof result === 'object' ? { ...result } : {}
                    if (!purchase.id) {
                        purchase.id = id
                    }
                    this._paymentsPurchases.push(purchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, purchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
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

            this.#fetchJson('/api/catalog')
                .then((data) => {
                    let list = []
                    if (Array.isArray(data)) {
                        list = data
                    } else if (data && Array.isArray(data.data)) {
                        list = data.data
                    }
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, list)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#fetchJson('/api/purchases')
                .then((data) => {
                    let list = []
                    if (Array.isArray(data)) {
                        list = data
                    } else if (data && Array.isArray(data.data)) {
                        list = data.data
                    }
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, list)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    // social
    createPost(options = {}) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#fetchJson('/api/create-post', { method: 'POST', body: { options } })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CREATE_POST, error)
                })
        }

        return promiseDecorator.promise
    }

    joinCommunity() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this.#fetchJson('/api/join-community', { method: 'POST' })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, error)
                })
        }

        return promiseDecorator.promise
    }

    #fetchJson(url, { method = 'GET', body } = {}) {
        const init = { method, headers: {} }
        if (body !== undefined) {
            init.headers['Content-Type'] = 'application/json'
            init.body = JSON.stringify(body)
        }

        return fetch(url, init).then((response) => {
            if (!response.ok) {
                return response.text().then((text) => {
                    const detail = text ? `: ${text}` : ''
                    throw new Error(`${method} ${url} failed (${response.status})${detail}`)
                })
            }

            return response.text().then((text) => {
                if (!text) {
                    return null
                }

                try {
                    return JSON.parse(text)
                } catch (_) {
                    return null
                }
            })
        })
    }
}

export default RedditPlatformBridge
