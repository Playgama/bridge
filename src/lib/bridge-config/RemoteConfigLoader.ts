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

import {
    REMOTE_CONFIG_CACHE_STORAGE_KEY,
    REMOTE_CONFIG_DEFAULT_TIMEOUT,
    REMOTE_CONFIG_DEFAULT_TTL,
} from './constants'
import localStorage from '../LocalStorage'
import logger from '../logger'
import type { AnyRecord } from '../../utils'

export const REMOTE_LOAD_STATUS = {
    PENDING: 'pending',
    LOADING: 'loading',
    SUCCESS: 'success',
    FAILED: 'failed',
    TIMEOUT: 'timeout',
    SKIPPED: 'skipped',
} as const

export type RemoteLoadStatus = typeof REMOTE_LOAD_STATUS[keyof typeof REMOTE_LOAD_STATUS]

export const REMOTE_APPLIED_SOURCE = {
    NETWORK: 'network',
    FRESH_CACHE: 'fresh-cache',
    STALE_CACHE: 'stale-cache',
} as const

export type RemoteAppliedSource = typeof REMOTE_APPLIED_SOURCE[keyof typeof REMOTE_APPLIED_SOURCE]

export interface RemoteConfigLoaderOptions {
    url: string
    timeoutMs?: number
    ttlMs?: number
}

export interface RemoteConfigLoadResult {
    source: RemoteAppliedSource | null
    options: AnyRecord | null
    error?: string
}

interface CacheRecord {
    url: string
    savedAt: number
    options: AnyRecord
}

class RemoteConfigLoader {
    // public getters
    get loadStatus(): RemoteLoadStatus {
        return this.#loadStatus
    }

    get loadError(): string {
        return this.#loadError
    }

    get appliedSource(): RemoteAppliedSource | null {
        return this.#appliedSource
    }

    // private properties
    #url: string

    #timeoutMs: number

    #ttlMs: number

    #loadStatus: RemoteLoadStatus = REMOTE_LOAD_STATUS.PENDING

    #loadError = ''

    #appliedSource: RemoteAppliedSource | null = null

    constructor({ url, timeoutMs, ttlMs }: RemoteConfigLoaderOptions) {
        this.#url = url
        this.#timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : REMOTE_CONFIG_DEFAULT_TIMEOUT
        this.#ttlMs = typeof ttlMs === 'number' ? ttlMs : REMOTE_CONFIG_DEFAULT_TTL
    }

    // public methods
    async load(): Promise<RemoteConfigLoadResult> {
        if (!this.#url) {
            this.#loadStatus = REMOTE_LOAD_STATUS.SKIPPED
            return { source: null, options: null }
        }

        const cache = this.#readCache()

        if (cache && !this.#isStale(cache)) {
            this.#appliedSource = REMOTE_APPLIED_SOURCE.FRESH_CACHE
            this.#loadStatus = REMOTE_LOAD_STATUS.SUCCESS
            this.refreshInBackground()
            return { source: REMOTE_APPLIED_SOURCE.FRESH_CACHE, options: cache.options }
        }

        try {
            this.#loadStatus = REMOTE_LOAD_STATUS.LOADING
            const options = await this.#fetchWithTimeout(this.#timeoutMs)
            this.#writeCache(options)
            this.#appliedSource = REMOTE_APPLIED_SOURCE.NETWORK
            this.#loadStatus = REMOTE_LOAD_STATUS.SUCCESS
            return { source: REMOTE_APPLIED_SOURCE.NETWORK, options }
        } catch (error) {
            const isTimeout = (error as Error)?.name === 'AbortError'
            this.#loadStatus = isTimeout ? REMOTE_LOAD_STATUS.TIMEOUT : REMOTE_LOAD_STATUS.FAILED
            this.#loadError = (error as Error)?.message || String(error)
            logger.error('Remote config load failed:', error)

            if (cache) {
                this.#appliedSource = REMOTE_APPLIED_SOURCE.STALE_CACHE
                return {
                    source: REMOTE_APPLIED_SOURCE.STALE_CACHE,
                    options: cache.options,
                    error: this.#loadError,
                }
            }

            return { source: null, options: null, error: this.#loadError }
        }
    }

    refreshInBackground(): void {
        if (!this.#url) {
            return
        }

        this.#fetchWithTimeout(this.#timeoutMs)
            .then((options) => {
                this.#writeCache(options)
            })
            .catch((error) => {
                logger.error('Remote config background refresh failed:', error)
            })
    }

    // private methods
    async #fetchWithTimeout(timeoutMs: number): Promise<AnyRecord> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
            const response = await fetch(this.#url, { signal: controller.signal })

            if (!response.ok) {
                throw new Error(`Failed to load remote bridge config: ${this.#url} ${response.status} (${response.statusText})`)
            }

            const text = await response.text()
            const parsed = JSON.parse(text) as unknown

            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Remote bridge config must be a JSON object')
            }

            return parsed as AnyRecord
        } finally {
            clearTimeout(timer)
        }
    }

    #readCache(): CacheRecord | null {
        const raw = localStorage.getItem(REMOTE_CONFIG_CACHE_STORAGE_KEY)
        if (!raw) {
            return null
        }

        try {
            const parsed = JSON.parse(raw) as Partial<CacheRecord>
            if (
                !parsed
                || parsed.url !== this.#url
                || typeof parsed.savedAt !== 'number'
                || !parsed.options
                || typeof parsed.options !== 'object'
            ) {
                return null
            }

            return parsed as CacheRecord
        } catch {
            return null
        }
    }

    #writeCache(options: AnyRecord): void {
        try {
            const record: CacheRecord = {
                url: this.#url,
                savedAt: Date.now(),
                options,
            }
            localStorage.setItem(REMOTE_CONFIG_CACHE_STORAGE_KEY, JSON.stringify(record))
        } catch {
            // Quota or disabled storage — silently ignore.
        }
    }

    #isStale(cache: CacheRecord): boolean {
        return cache.savedAt + this.#ttlMs < Date.now()
    }
}

export default RemoteConfigLoader
