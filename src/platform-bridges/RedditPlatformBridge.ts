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
import {
    ACTION_NAME,
    PLATFORM_ID,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    type PlatformId,
    type CloudStorageMode,
} from '../constants'
import { postToParent } from '../common/utils'

interface DevvitMessageData {
    type?: string
    isPlayerAuthorized?: boolean
    playerId?: string
    playerName?: string
    playerPhoto?: string
    data?: {
        success?: boolean
        data?: unknown
        [key: string]: unknown
    }
    [key: string]: unknown
}

interface DevvitMessageEvent {
    type: 'devvit-message'
    data: { message: DevvitMessageData }
}

class RedditPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.REDDIT
    }

    get isPaymentsSupported(): boolean {
        return true
    }

    get isJoinCommunitySupported(): boolean {
        return true
    }

    get isCreatePostSupported(): boolean {
        return true
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.LAZY
    }

    get cloudStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            window.addEventListener('message', (event: MessageEvent) => {
                const eventData = event.data as DevvitMessageEvent | undefined
                if (eventData?.type === 'devvit-message') {
                    const { message } = eventData.data
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
                        this.#handleJoinCommunity(message)
                    }
                }
            })

            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this.#postMessage(ACTION_NAME.INITIALIZE)
        }

        return promiseDecorator.promise
    }

    loadCloudKey(key: string): Promise<unknown> {
        const promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        this.#postMessage(ACTION_NAME.GET_STORAGE_DATA, { key })
        return promiseDecorator.promise
    }

    saveCloudKey(key: string, value: unknown): Promise<void> {
        const promiseDecorator = this._createPromiseDecorator<void>(ACTION_NAME.SET_STORAGE_DATA)
        this.#postMessage(ACTION_NAME.SET_STORAGE_DATA, { key, value })
        return promiseDecorator.promise
    }

    deleteCloudKey(key: string): Promise<void> {
        const promiseDecorator = this._createPromiseDecorator<void>(ACTION_NAME.DELETE_STORAGE_DATA)
        this.#postMessage(ACTION_NAME.DELETE_STORAGE_DATA, { key })
        return promiseDecorator.promise
    }

    paymentsPurchase(id: string): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#postMessage(ACTION_NAME.PURCHASE, { id })
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

            this.#postMessage(ACTION_NAME.GET_CATALOG)
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    createPost(options: unknown = {}): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#postMessage(ACTION_NAME.CREATE_POST, { options })
        }

        return promiseDecorator.promise
    }

    joinCommunity(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            this.#postMessage(ACTION_NAME.JOIN_COMMUNITY)
        }

        return promiseDecorator.promise
    }

    #postMessage(type: string, data: Record<string, unknown> = {}): void {
        postToParent({ type, data }, '*')
    }

    #handleInitialize(message: DevvitMessageData): void {
        this._isPlayerAuthorized = !!message.isPlayerAuthorized

        if (this._isPlayerAuthorized) {
            this._playerId = message.playerId ?? null
            this._playerName = message.playerName ?? null
            if (message.playerPhoto) {
                this._playerPhotos.push(message.playerPhoto)
            }
            this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
        }

        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
    }

    #handleGetStorage(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, message.data.data ?? null)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        }
    }

    #handleSetStorage(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        }
    }

    #handleDeleteStorage(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        }
    }

    #handlePurchase(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, message.data)
        }
    }

    #handleGetCatalog(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, message.data)
        }
    }

    #handleGetPurchases(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, message.data)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, message.data)
        }
    }

    #handleCreatePost(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.CREATE_POST)
        }
    }

    #handleJoinCommunity(message: DevvitMessageData): void {
        if (message.data?.success) {
            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        }
    }
}

export default RedditPlatformBridge
