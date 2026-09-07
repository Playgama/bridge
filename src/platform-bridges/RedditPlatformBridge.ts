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
import ServerTimeCache from '../lib/ServerTimeCache'
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import { LEADERBOARD_TYPE, type LeaderboardType } from '../modules/leaderboards/constants'
import type { LeaderboardEntry } from '../modules/leaderboards/types'
import type {
    ClaimOptions,
    ClaimResult,
    ClaimStatus,
    InboxOptions,
    Inbox,
} from '../modules/social/types'
import type { AnyRecord } from '../utils'

declare global {
    interface Window {
        __playgama_devvit?: {
            purchase: (id: string) => Promise<unknown> | unknown
        }
    }
}

// Reddit has no client SDK: every call goes over HTTP to the app's own Devvit
// server (`/api/*`), which talks to Reddit on the game's behalf. The endpoint
// contract is shared with the `bridge-reddit-devvit` server template.
interface InitializePayload {
    isPlayerAuthorized?: boolean
    playerId?: string
    playerName?: string
    playerPhoto?: string
    // Free-form launch payload the post was created with via `createPost()`.
    payload?: string
    // The post the game runs in, exposed as `platform.launchData`, with any
    // `data` it was created with via `createPost()` and — when the post is
    // claimable — the current player's claim status.
    postId?: string
    subredditName?: string
    postAuthorId?: string
    postData?: unknown
    claimable?: boolean
    claim?: ClaimStatus
}

// Raw entry from the server; numeric fields may arrive as strings.
interface LeaderboardEntryPayload {
    id?: string | number
    name?: string
    score?: number | string
    rank?: number | string
    photo?: string | null
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

    get platformPayload(): string | null {
        return this.#platformPayload ?? super.platformPayload
    }

    get isPlatformExternalCallsSupported(): boolean {
        return false
    }

    // social
    get isJoinCommunitySupported(): boolean {
        return true
    }

    // On Reddit sharing means leaving a comment under the post the game runs in.
    get isShareSupported(): boolean {
        return true
    }

    get isCreatePostSupported(): boolean {
        return true
    }

    get isClaimSupported(): boolean {
        return true
    }

    get isInboxSupported(): boolean {
        return true
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    #platformPayload: string | null = null

    #serverTimeCache = new ServerTimeCache(() => this.#fetchServerTime())

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

                    this.#platformPayload = payload.payload ?? null
                    if (payload.postId) {
                        this._launchData = {
                            id: payload.postId,
                            authorId: payload.postAuthorId ?? null,
                            data: payload.postData ?? null,
                            claimable: !!payload.claimable,
                            ...(payload.claim ? { claim: payload.claim } : {}),
                            postId: payload.postId,
                            subredditName: payload.subredditName ?? null,
                        }
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

    // platform
    getServerTime(): Promise<number> {
        return this.#serverTimeCache.getServerTime()
    }

    // storage — the server accepts key arrays, so each operation is a single round trip.
    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        const values = await this.#fetchJson('/api/storage/get', { method: 'POST', body: { key: keys } })
        const result: Record<string, unknown> = {}
        keys.forEach((key, index) => {
            const value = Array.isArray(values) ? values[index] : null
            if (value !== null && value !== undefined && value !== '') {
                result[key] = value
            }
        })
        return result
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        const keys = Object.keys(data)
        await this.#fetchJson('/api/storage/set', {
            method: 'POST',
            body: { key: keys, value: keys.map((key) => data[key]) },
        })
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        await this.#fetchJson('/api/storage/delete', { method: 'POST', body: { key: keys } })
    }

    // advertisement
    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
    }

    // social
    share(options?: unknown): Promise<unknown> {
        const { text, ...rest } = (options ?? {}) as AnyRecord & { text?: string }
        if (!text) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this.#fetchJson('/api/share', { method: 'POST', body: { options: { ...rest, text } } })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }

    // Creates a new post running this app. The canonical `text` becomes the post
    // title; any other field (`data` to attach, `claimable` to let others claim on
    // it, `payload`) is forwarded to the server verbatim. Resolves with
    // `{ id, url }` (plus the raw `postId` / `postUrl`).
    createPost(options?: unknown): Promise<unknown> {
        const { text, ...rest } = (options ?? {}) as AnyRecord & { text?: string; title?: string }
        const title = rest.title ?? text
        if (!title) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)

            this.#fetchJson('/api/create-post', { method: 'POST', body: { options: { ...rest, title } } })
                .then((data) => {
                    const result = (data ?? {}) as AnyRecord
                    this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST, {
                        ...result,
                        id: String(result.postId ?? result.id ?? ''),
                        url: typeof result.postUrl === 'string' ? result.postUrl : null,
                    })
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

    // Claim on the post the game runs in (created with createPost({ claimable: true })).
    claim(options: ClaimOptions): Promise<ClaimResult> {
        if (!this._isPlayerAuthorized || !this._launchData?.claimable) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLAIM)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLAIM)

            this.#fetchJson('/api/claim', { method: 'POST', body: { options } })
                .then((data) => {
                    this._resolvePromiseDecorator(ACTION_NAME.CLAIM, data)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CLAIM, error)
                })
        }

        return promiseDecorator.promise as Promise<ClaimResult>
    }

    getInbox(options: InboxOptions): Promise<Inbox> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_INBOX)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_INBOX)

            this.#fetchJson('/api/inbox', { method: 'POST', body: { options } })
                .then((data) => {
                    const result = (data ?? {}) as AnyRecord
                    this._resolvePromiseDecorator(ACTION_NAME.GET_INBOX, {
                        events: this.#extractList(result.events),
                        serverTime: Number(result.serverTime ?? 0),
                    })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_INBOX, error)
                })
        }

        return promiseDecorator.promise as Promise<Inbox>
    }

    // leaderboards
    leaderboardsSetScore(id: string, score: number, isMain: boolean): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            this.#fetchJson('/api/leaderboards/set-score', { method: 'POST', body: { id, score, isMain } })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id: string): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            this.#fetchJson(`/api/leaderboards/entries?id=${encodeURIComponent(id)}`)
                .then((data) => {
                    const entries: LeaderboardEntry[] = this.#extractList(data).map((entry) => {
                        const {
                            id: entryId, name, score, rank, photo,
                        } = (entry ?? {}) as LeaderboardEntryPayload
                        return {
                            id: String(entryId ?? ''),
                            name: name ?? '',
                            score: Number(score ?? 0),
                            rank: Number(rank ?? 0),
                            photo: photo ?? null,
                        }
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, error)
                })
        }

        return promiseDecorator.promise
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

    #fetchServerTime(): Promise<number> {
        return this.#fetchJson('/api/server-time').then((data) => {
            const time = Number((data as AnyRecord | null)?.serverTime)
            if (!Number.isFinite(time)) {
                throw new Error('Invalid server time')
            }
            return time
        })
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
