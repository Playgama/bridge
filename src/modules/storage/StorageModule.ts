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

import eventBus from '../../lib/EventBus'
import ModuleBase from '../ModuleBase'
import { BridgeError, ERROR_CODE, EVENT_NAME } from '../../constants'
import localStorage from '../../lib/LocalStorage'
import MemoryCache from './internals/MemoryCache'
import OperationQueue from './internals/OperationQueue'
import PendingJournal from './internals/PendingJournal'
import FlushScheduler from './internals/FlushScheduler'
import { STORAGE_FLUSH_INTERVAL_MS } from './constants'
import { isEmpty, parseValue, serializeValue } from './helpers'
import type { StorageBridgeContract, StorageEntry, WriteBatch } from './types'

// Public storage module. Every call (get / set / delete), flush and availability change runs one
// at a time through a single queue, so they always see each other's effects. The runtime cache
// is what the game reads and writes; the active store is the platform cloud when it is
// available, otherwise local storage. How a platform reads and writes its cloud lives entirely
// in the platform bridge.
//
// Cloud store: loaded values stay in the cache and are served without another SDK call. A write
// only updates the cache (unchanged values are ignored) and the pending journal in local
// storage. Pending changes go to the cloud at most once per STORAGE_FLUSH_INTERVAL_MS, and right
// away when the page is hidden or closed; once sent, they are dropped from the journal. When the
// player changes (e.g. a guest authorizes), the cloud wins: the cache is rebuilt from it alone
// and local guest data is dropped.
//
// Local store (cloud unavailable): writes go straight to local storage.
class StorageModule extends ModuleBase<StorageBridgeContract> {
    #cache = new MemoryCache()

    #queue = new OperationQueue()

    #journal = new PendingJournal()

    #flushScheduler = new FlushScheduler(() => this.#enqueueFlush(), STORAGE_FLUSH_INTERVAL_MS)

    // Player the cached cloud data belongs to; undefined until the next cloud operation sets it.
    #ownerId: string | null | undefined = undefined

    initialize(platformBridge: StorageBridgeContract): this {
        super.initialize(platformBridge)

        this._platformBridge.on(EVENT_NAME.PLATFORM_STORAGE_AVAILABILITY_CHANGED, (isAvailable: unknown) => {
            this.#queue.enqueue(() => this.#onAvailabilityChanged(Boolean(isAvailable))).catch(() => {})
        })

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.#flushScheduler.flushNow()
            }
        })
        window.addEventListener('pagehide', () => this.#flushScheduler.flushNow())
        return this
    }

    get(key: string | string[], tryParseJson = true): Promise<unknown> {
        const isArray = Array.isArray(key)
        if (isArray && key.length === 0) {
            return Promise.resolve([])
        }

        const keys = isArray ? key : [key]
        const values = this.#queue.enqueue(() => this.#get(keys, tryParseJson))
        return isArray ? values : values.then((result) => result[0])
    }

    set(key: string | string[], value: unknown | unknown[]): Promise<void> {
        eventBus.emit(EVENT_NAME.STORAGE_SET)

        if (Array.isArray(key)) {
            if (!Array.isArray(value)) {
                return Promise.reject(new Error('Value must be an array when key is an array'))
            }
            if (key.length !== value.length) {
                return Promise.reject(new Error('Key and value arrays must have the same length'))
            }
            if (key.length === 0) {
                return Promise.resolve()
            }
            return this.#queue.enqueue(() => this.#write(this.#buildEntries(key, value)))
        }

        return this.#queue.enqueue(() => this.#write(this.#buildEntries([key], [value])))
    }

    delete(key: string | string[]): Promise<void> {
        const keys = Array.isArray(key) ? key : [key]
        if (keys.length === 0) {
            return Promise.resolve()
        }
        return this.#queue.enqueue(() => this.#write(this.#buildEntries(keys, keys.map(() => null))))
    }

    // Turns a write into entries with serialized values; an empty value (null / undefined / '')
    // means "no data" and becomes null, i.e. a delete. A key repeated in one call keeps its last value.
    #buildEntries(keys: string[], values: unknown[]): StorageEntry[] {
        const entries = new Map<string, unknown>()
        keys.forEach((key, i) => {
            entries.set(key, isEmpty(values[i]) ? null : serializeValue(values[i]))
        })
        return [...entries].map(([key, value]) => ({ key, value }))
    }

    async #get(keys: string[], tryParseJson: boolean): Promise<unknown[]> {
        if (!this.#usePlatform()) {
            return this.#getFromLocal(keys, tryParseJson)
        }

        this.#ensureOwner()
        const missing = keys.filter((key) => !this.#cache.has(key))
        if (missing.length > 0) {
            try {
                await this.#loadFromCloud(missing)
            } catch (error) {
                // No local fallback: it would hand the game a mix of cloud and guest data. The
                // missing keys stay unknown, so the game can retry and the next read asks the cloud.
                throw new BridgeError(ERROR_CODE.STORAGE_NOT_AVAILABLE, error)
            }
        }

        return keys.map((key) => parseValue(this.#cache.get(key), tryParseJson))
    }

    // Loads keys into the cache. The cloud wins as a whole: a key it does not have stays empty and
    // local guest copies are dropped, so the game never gets a mix of cloud and guest data.
    async #loadFromCloud(keys: string[]): Promise<void> {
        const data = await this._platformBridge.getDataFromStorage(keys)
        // A platform that loads its whole dataset at once returns more keys — cache them all.
        Object.keys(data).forEach((key) => this.#cache.load(key, data[key]))

        keys.forEach((key) => {
            if (!(key in data)) {
                this.#cache.load(key, null)
            }
            localStorage.removeItem(key)
        })
    }

    async #write(entries: StorageEntry[]): Promise<void> {
        if (!this.#usePlatform()) {
            this.#writeToLocal(entries)
            return
        }

        this.#ensureOwner()
        const changed = this.#filterChanged(entries)
        if (changed.length === 0) {
            return
        }

        changed.forEach((entry) => {
            this.#cache.set(entry.key, entry.value)
            if (entry.value === null) {
                localStorage.removeItem(entry.key)
            }
        })
        this.#saveJournal()
        this.#flushScheduler.schedule()
    }

    #writeToLocal(entries: StorageEntry[]): void {
        this.#assertLocalAvailable()
        const changed = this.#filterChanged(entries)
        if (changed.length === 0) {
            return
        }

        try {
            changed.forEach((entry) => {
                if (entry.value === null) {
                    localStorage.removeItem(entry.key)
                } else {
                    localStorage.setItem(entry.key, entry.value as string)
                }
            })
        } catch (error) {
            if (error && (error as Error).name === 'QuotaExceededError') {
                throw new BridgeError(ERROR_CODE.STORAGE_QUOTA_EXCEEDED)
            }
            throw error
        }

        changed.forEach((entry) => this.#cache.set(entry.key, entry.value))
        this._platformBridge.notifyLocalDataChanged?.(this.#toBatch(changed))
    }

    // Sends the pending changes to the cloud. On failure they stay pending (and journaled) and a
    // retry is scheduled.
    async #flush(): Promise<void> {
        if (!this.#usePlatform()) {
            return
        }

        this.#ensureOwner()
        const dirty = this.#cache.dirtyKeys()
        if (dirty.length === 0) {
            return
        }

        const sets = dirty.filter((key) => this.#cache.get(key) !== null)
        const deletes = dirty.filter((key) => this.#cache.get(key) === null)
        try {
            if (sets.length > 0) {
                const data: Record<string, unknown> = {}
                sets.forEach((key) => { data[key] = this.#cache.get(key) })
                await this._platformBridge.setDataToStorage(data)
                this.#confirm(sets)
            }
            if (deletes.length > 0) {
                await this._platformBridge.deleteDataFromStorage(deletes)
                this.#confirm(deletes)
            }
        } catch {
            this.#flushScheduler.schedule()
        }

        this.#saveJournal()
    }

    #enqueueFlush(): void {
        this.#queue.enqueue(() => this.#flush()).catch(() => {})
    }

    // The keys are in the cloud now — the local guest copies are stale.
    #confirm(keys: string[]): void {
        keys.forEach((key) => {
            this.#cache.confirm(key)
            localStorage.removeItem(key)
        })
    }

    async #onAvailabilityChanged(isAvailable: boolean): Promise<void> {
        // The next cloud operation rebuilds the cache from the cloud (see #ensureOwner).
        this.#ownerId = undefined
        if (isAvailable) {
            return
        }

        // Cloud turned off: keep a local copy of what the game has seen so it survives. Unsent
        // changes also stay in the journal and are sent once the cloud is back for this player.
        this.#cache.keys().forEach((key) => {
            const value = this.#cache.get(key)
            try {
                if (value === null) {
                    localStorage.removeItem(key)
                } else {
                    localStorage.setItem(key, serializeValue(value) as string)
                }
            } catch {
                // Ignore a single failed key (e.g. quota) — the rest still get written.
            }
        })
    }

    // Makes sure the cache holds the current player's cloud data. When the player changes, or the
    // cloud has just turned on, the cache is dropped so it is rebuilt from the cloud, and unsent
    // changes this player left in a previous session are picked up again.
    #ensureOwner(): void {
        const playerId = this._platformBridge.playerId ?? null
        if (this.#ownerId === playerId) {
            return
        }

        this.#ownerId = playerId
        this.#cache.clear()

        const pending = this.#journal.load()
        if (!pending) {
            return
        }
        if (pending.playerId !== playerId) {
            // Changes of another player — never send them to this player's cloud.
            this.#journal.clear()
            return
        }

        Object.keys(pending.data).forEach((key) => this.#cache.set(key, pending.data[key]))
        this.#flushScheduler.schedule()
    }

    // ---------------------------------------------------------------- helpers

    #getFromLocal(keys: string[], tryParseJson: boolean): unknown[] {
        this.#assertLocalAvailable()
        return keys.map((key) => {
            if (!this.#cache.has(key)) {
                this.#cache.set(key, localStorage.getItem(key))
            }
            return parseValue(this.#cache.get(key), tryParseJson)
        })
    }

    // Drops entries that would not change anything the cache already knows.
    #filterChanged(entries: StorageEntry[]): StorageEntry[] {
        return entries.filter((entry) => !this.#cache.has(entry.key) || this.#cache.get(entry.key) !== entry.value)
    }

    #saveJournal(): void {
        const data: Record<string, unknown> = {}
        this.#cache.dirtyKeys().forEach((key) => { data[key] = this.#cache.get(key) })
        this.#journal.save({ playerId: this.#ownerId ?? null, data })
    }

    #toBatch(entries: StorageEntry[]): WriteBatch {
        return {
            sets: entries.filter((entry) => entry.value !== null),
            deletes: entries.filter((entry) => entry.value === null).map((entry) => entry.key),
        }
    }

    #assertLocalAvailable(): void {
        if (!localStorage.isAvailable) {
            throw new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED)
        }
    }

    // Platform storage is used only when the platform reports it is currently available
    // (e.g. after the player is authorized). Platforms without cloud storage never report true.
    #usePlatform(): boolean {
        return this._platformBridge.isPlatformStorageAvailable
    }
}

export default StorageModule
