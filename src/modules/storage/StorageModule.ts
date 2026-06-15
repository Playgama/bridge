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

import ModuleBase from '../ModuleBase'
import { BridgeError, ERROR_CODE, EVENT_NAME } from '../../constants'
import localStorage from '../../lib/LocalStorage'
import MemoryCache from './internals/MemoryCache'
import OperationQueue from './internals/OperationQueue'
import { isEmpty, parseValue, serializeValue } from './helpers'
import type { StorageBridgeContract, StorageEntry, WriteBatch } from './types'

// Public storage module. Every call (get / set / delete) and every availability migration runs
// one at a time through a single queue, so they always see each other's effects and the cache
// is never touched concurrently. The cache is the runtime source of truth; the active store is
// the platform cloud when it is available, otherwise local storage. Data automatically migrates
// between the two as availability changes or as the game touches keys. How a platform actually
// reads and writes its cloud storage lives entirely in the platform bridge.
class StorageModule extends ModuleBase<StorageBridgeContract> {
    #cache = new MemoryCache()

    #queue = new OperationQueue()

    initialize(platformBridge: StorageBridgeContract): this {
        super.initialize(platformBridge)

        this._platformBridge.on(EVENT_NAME.PLATFORM_STORAGE_AVAILABILITY_CHANGED, (isAvailable: unknown) => {
            this.#queue.enqueue(() => this.#migrate(Boolean(isAvailable))).catch(() => {})
        })
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
            return this.#queue.enqueue(() => this.#set(this.#buildBatch(key, value)))
        }

        return this.#queue.enqueue(() => this.#set(this.#buildBatch([key], [value])))
    }

    delete(key: string | string[]): Promise<void> {
        const keys = Array.isArray(key) ? key : [key]
        if (keys.length === 0) {
            return Promise.resolve()
        }
        return this.#queue.enqueue(() => this.#delete(keys))
    }

    // Writing an empty value (null / undefined / '') means "no data", so it is turned into a
    // delete of that key.
    #buildBatch(keys: string[], values: unknown[]): WriteBatch {
        const batch: WriteBatch = { sets: [], deletes: [] }
        keys.forEach((key, i) => {
            if (isEmpty(values[i])) {
                batch.deletes.push(key)
            } else {
                batch.sets.push({ key, value: serializeValue(values[i]) })
            }
        })
        return batch
    }

    async #get(keys: string[], tryParseJson: boolean): Promise<unknown[]> {
        // 1. Cache fast-path: every key is already known — return straight from the cache.
        if (keys.every((key) => this.#cache.has(key))) {
            return keys.map((key) => parseValue(this.#cache.get(key), tryParseJson))
        }

        // 2. Cloud unavailable — read from local storage.
        if (!this.#usePlatform()) {
            return this.#getFromLocal(keys, tryParseJson)
        }

        // 3. Load the missing keys from the cloud; if the platform is not ready, fall back to local.
        try {
            const missing = keys.filter((key) => !this.#cache.has(key) && !this.#cache.isDeleted(key))
            if (missing.length > 0) {
                const data = await this._platformBridge.getDataFromStorage(missing)
                Object.keys(data).forEach((key) => {
                    // Keep pending local changes; take the cloud value for everything else.
                    if (!this.#cache.isDirty(key) && !this.#cache.isDeleted(key)) {
                        this.#cache.set(key, data[key])
                    }
                })
            }
        } catch {
            return this.#getFromLocal(keys, tryParseJson)
        }

        const values = await this.#resolveWithLocalFallback(keys)
        return values.map((value) => parseValue(value, tryParseJson))
    }

    // For each key after a cloud load: a cloud hit wins and its stale local shadow is dropped;
    // a cloud miss falls back to local storage and is migrated up to the cloud.
    async #resolveWithLocalFallback(keys: string[]): Promise<unknown[]> {
        const cloudHits: string[] = []
        const migrations: StorageEntry[] = []

        const values = keys.map((key) => {
            if (this.#cache.has(key)) {
                if (this.#cache.isDirty(key)) {
                    // In the cache but not in the cloud — push it up rather than drop its shadow.
                    migrations.push({ key, value: this.#cache.get(key) })
                } else {
                    // Confirmed cloud value — drop the now-stale local shadow.
                    cloudHits.push(key)
                }
                return this.#cache.get(key)
            }

            // Pending deletion — stay deleted instead of migrating a lingering local copy back up.
            if (this.#cache.isDeleted(key)) {
                return null
            }

            const local = this.#getLocalItem(key)
            if (isEmpty(local)) {
                return null
            }

            migrations.push({ key, value: local })
            return local
        })

        this.#deleteFromLocal(cloudHits)
        if (migrations.length > 0) {
            await this.#migrateToCloud(migrations)
        }
        return values
    }

    // Pushes local-only values up to the cloud. Best-effort: on failure the values stay in
    // local storage and are returned to the game anyway, to be retried on a later read.
    async #migrateToCloud(entries: StorageEntry[]): Promise<void> {
        try {
            await this._platformBridge.setDataToStorage(this.#toRecord(entries))
            // Now confirmed in the cloud: record as clean and drop the local copies.
            entries.forEach((entry) => this.#cache.set(entry.key, entry.value))
            this.#deleteFromLocal(entries.map((entry) => entry.key))
        } catch {
            // Migration failed — leave local storage and the cache untouched for a later retry.
        }
    }

    async #set(batch: WriteBatch): Promise<void> {
        if (this.#usePlatform()) {
            try {
                if (batch.sets.length > 0) {
                    await this._platformBridge.setDataToStorage(this.#toRecord(batch.sets))
                }
                if (batch.deletes.length > 0) {
                    await this._platformBridge.deleteDataFromStorage(batch.deletes)
                }
                // Cloud holds these now — record them as clean and drop the local shadows.
                this.#applyToCache(batch, false)
                this.#deleteFromLocal([...batch.sets.map((entry) => entry.key), ...batch.deletes])
                return
            } catch {
                // Cloud not ready or write failed — fall through to local storage.
            }
        }

        this.#setToLocal(batch)
    }

    #setToLocal(batch: WriteBatch): void {
        if (!localStorage.isAvailable) {
            throw new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED)
        }

        try {
            batch.sets.forEach((entry) => localStorage.setItem(entry.key, entry.value as string))
            batch.deletes.forEach((key) => localStorage.removeItem(key))
        } catch (error) {
            if (error && (error as Error).name === 'QuotaExceededError') {
                throw new BridgeError(ERROR_CODE.STORAGE_QUOTA_EXCEEDED)
            }
            throw error
        }

        // These values live only in local storage until a later read or migration syncs them up.
        this.#applyToCache(batch, true)
        this._platformBridge.notifyLocalDataChanged?.(batch)
    }

    async #delete(keys: string[]): Promise<void> {
        // The local copy is always dropped (spec: in parallel with the cloud delete).
        this.#deleteFromLocal(keys)

        if (this.#usePlatform()) {
            try {
                await this._platformBridge.deleteDataFromStorage(keys)
                keys.forEach((key) => this.#cache.delete(key))
                return
            } catch {
                // Cloud not ready or delete failed — fall through and keep a tombstone so the
                // delete is retried on the next sync, instead of resurrecting from the cloud.
            }
        }

        keys.forEach((key) => this.#cache.tombstone(key))
        this._platformBridge.notifyLocalDataChanged?.({ sets: [], deletes: keys })
    }

    // The platform turned cloud storage on or off. Flush the cached data to whichever store is
    // now active, using the cache as the source of truth.
    async #migrate(isAvailable: boolean): Promise<void> {
        if (isAvailable && this.#usePlatform()) {
            // Cloud turned on. Push up the local changes made while it was off: dirty keys
            // (pending writes) and tombstones (pending deletes). Clean keys are already in the
            // cloud. Then drop the local shadows and the cache — the cloud is now the store, and
            // the next read rebuilds the cache fresh from it.
            const dirty = this.#cache.dirtyKeys()
            const deleted = this.#cache.deletedKeys()
            try {
                if (dirty.length > 0) {
                    const entries = dirty.map((key) => ({ key, value: this.#cache.get(key) }))
                    await this._platformBridge.setDataToStorage(this.#toRecord(entries))
                }
                if (deleted.length > 0) {
                    await this._platformBridge.deleteDataFromStorage(deleted)
                }
                this.#deleteFromLocal([...this.#cache.keys(), ...deleted])
                this.#cache.clear()
            } catch {
                // Could not reach the cloud — keep the cache and local storage as they are.
            }
            return
        }

        // Cloud turned off: keep a local copy of the cached data so it survives.
        if (localStorage.isAvailable) {
            this.#cache.keys().forEach((key) => {
                try {
                    localStorage.setItem(key, serializeValue(this.#cache.get(key)) as string)
                } catch {
                    // Ignore a single failed key (e.g. quota) — the rest still get written.
                }
            })
        }
    }

    // ---------------------------------------------------------------- helpers

    #getFromLocal(keys: string[], tryParseJson: boolean): unknown[] {
        if (!localStorage.isAvailable) {
            throw new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED)
        }

        return keys.map((key) => {
            // A value already known (or a key pending deletion) wins over local storage, so a
            // missing local entry never clobbers it.
            if (this.#cache.has(key)) {
                return parseValue(this.#cache.get(key), tryParseJson)
            }
            if (this.#cache.isDeleted(key)) {
                return null
            }

            const raw = localStorage.getItem(key)
            // Read from local storage; treat as unconfirmed in the cloud until proven otherwise.
            this.#cache.setDirty(key, raw)
            return parseValue(raw, tryParseJson)
        })
    }

    #getLocalItem(key: string): string | null {
        return localStorage.isAvailable ? localStorage.getItem(key) : null
    }

    #deleteFromLocal(keys: string[]): void {
        if (!localStorage.isAvailable) {
            return
        }
        keys.forEach((key) => localStorage.removeItem(key))
    }

    // Mirrors a write batch into the cache. `dirty` means the batch is not yet confirmed in the
    // cloud: its sets become dirty values and its deletes become tombstones (pending deletes). A
    // clean apply records confirmed cloud values and plain deletes.
    #applyToCache(batch: WriteBatch, dirty: boolean): void {
        batch.sets.forEach((entry) => {
            if (dirty) {
                this.#cache.setDirty(entry.key, entry.value)
            } else {
                this.#cache.set(entry.key, entry.value)
            }
        })
        batch.deletes.forEach((key) => {
            if (dirty) {
                this.#cache.tombstone(key)
            } else {
                this.#cache.delete(key)
            }
        })
    }

    #toRecord(entries: StorageEntry[]): Record<string, unknown> {
        const record: Record<string, unknown> = {}
        entries.forEach((entry) => { record[entry.key] = entry.value })
        return record
    }

    // Platform storage is used only when the platform reports it is currently available
    // (e.g. after the player is authorized). Platforms without cloud storage never report true.
    #usePlatform(): boolean {
        return this._platformBridge.isPlatformStorageAvailable
    }
}

export default StorageModule
