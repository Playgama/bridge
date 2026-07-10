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
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import type { AnyRecord } from '../utils'

declare global {
    interface Window {
        __playgama_devvit?: {
            purchase: (id: string) => Promise<unknown> | unknown
        }
    }
}

interface InitializePayload {
    isPlayerAuthorized?: boolean
    playerId?: string
    playerName?: string
    playerPhoto?: string
}

interface FetchJsonOptions {
    method?: string
    body?: unknown
}

class RedditPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.REDDIT
    }

    get isPlatformExternalCallsSupported(): boolean {
        return false
    }

    // social
    get isJoinCommunitySupported(): boolean {
        return true
    }

    get isCreatePostSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.#fetchJson('/api/initialize')
                .then((data) => {
                    const payload = (data as InitializePayload) || {}
                    this._isPlayerAuthorized = !!payload.isPlayerAuthorized

                    if (this._isPlayerAuthorized) {
                        this._playerId = payload.playerId ?? null
                        this._playerName = payload.playerName ?? null
                        if (payload.playerPhoto) {
                            this._playerPhotos.push(payload.playerPhoto)
                        }
                        this._setPlatformStorageAvailable(true)
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

    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        const result: Record<string, unknown> = {}
        await Promise.all(keys.map(async (key) => {
            const value = await this.#fetchJson('/api/storage/get', { method: 'POST', body: { key } })
            if (value !== null && value !== undefined && value !== '') {
                result[key] = value
            }
        }))
        return result
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(Object.keys(data).map((key) => this.#fetchJson('/api/storage/set', { method: 'POST', body: { key, value: data[key] } })))
            .then(() => undefined)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(keys.map((key) => this.#fetchJson('/api/storage/delete', { method: 'POST', body: { key } })))
            .then(() => undefined)
    }

    // advertisement
    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
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
                    const purchase = (result && typeof result === 'object'
                        ? { ...(result as AnyRecord) }
                        : {}) as AnyRecord & { id: string }
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

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#fetchJson('/api/catalog')
                .then((data) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, this.#extractList(data))
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#fetchJson('/api/purchases')
                .then((data) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this.#extractList(data))
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    createPost(options: unknown = {}): Promise<unknown> {
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

    joinCommunity(): Promise<unknown> {
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

    #ensureStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    #extractList(data: unknown): unknown[] {
        if (Array.isArray(data)) {
            return data
        }

        const nested = (data as AnyRecord | null)?.data
        if (Array.isArray(nested)) {
            return nested
        }

        return []
    }

    #fetchJson(url: string, { method = 'GET', body }: FetchJsonOptions = {}): Promise<unknown> {
        const headers: Record<string, string> = {}
        const init: RequestInit = { method, headers }
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json'
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
                } catch {
                    return null
                }
            })
        })
    }
}

export default RedditPlatformBridge
