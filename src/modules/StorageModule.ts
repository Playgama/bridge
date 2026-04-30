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

import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import {
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    ERROR,
    EVENT_NAME,
    type StorageType,
    type CloudStorageMode,
} from '../constants'

export interface StorageBridgeContract extends PlatformBridgeLike {
    defaultStorageType: StorageType
    cloudStorageMode: CloudStorageMode
    cloudStorageReady: Promise<void>
    _localStorage: Storage | null
    loadCloudSnapshot(): Promise<Record<string, unknown>>
    saveCloudSnapshot(snapshot: Record<string, unknown>, changedKeys: string[]): Promise<void>
    deleteCloudKeys(snapshot: Record<string, unknown>, deletedKeys: string[]): Promise<void>
    loadCloudKey(key: string): Promise<unknown>
    saveCloudKey(key: string, value: unknown): Promise<void>
    deleteCloudKey(key: string): Promise<void>
}

interface MigrationEntry {
    key: string
    value: string
}

class StorageModule extends ModuleBase<StorageBridgeContract> {
    get defaultType(): StorageType {
        return this._platformBridge.defaultStorageType
    }

    #cache: Record<string, unknown> | null = null

    #cacheLoaded = false

    #loadPromise: Promise<void> | null = null

    #pendingKeyLoads: Map<string, Promise<void>> = new Map()

    #writeQueue: Promise<unknown> = Promise.resolve()

    constructor(platformBridge: StorageBridgeContract) {
        super(platformBridge)

        this._platformBridge.on(EVENT_NAME.DEFAULT_STORAGE_TYPE_CHANGED, () => {
            this.#resetCloudState()
        })
    }

    get(key: string | string[], tryParseJson = true): Promise<unknown> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve([])
        }

        const storageType = this.defaultType
        const cloudMode = this._platformBridge.cloudStorageMode

        if (storageType === STORAGE_TYPE.LOCAL_STORAGE || cloudMode === CLOUD_STORAGE_MODE.NONE) {
            return this.#readFromLocalStorage(key, tryParseJson)
        }

        return this.#readFromCloud(key, tryParseJson, cloudMode)
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
        }

        const storageType = this.defaultType
        const cloudMode = this._platformBridge.cloudStorageMode

        if (storageType === STORAGE_TYPE.LOCAL_STORAGE || cloudMode === CLOUD_STORAGE_MODE.NONE) {
            return this.#writeToLocalStorage(key, value)
        }

        return this.#enqueueWrite(() => this.#writeToCloud(key, value, cloudMode)) as Promise<void>
    }

    delete(key: string | string[]): Promise<void> {
        if (Array.isArray(key) && key.length === 0) {
            return Promise.resolve()
        }

        const storageType = this.defaultType
        const cloudMode = this._platformBridge.cloudStorageMode

        if (storageType === STORAGE_TYPE.LOCAL_STORAGE || cloudMode === CLOUD_STORAGE_MODE.NONE) {
            return this.#deleteFromLocalStorage(key)
        }

        return this.#enqueueWrite(() => this.#deleteFromCloud(key, cloudMode)) as Promise<void>
    }

    // --- localStorage path ---

    #readFromLocalStorage(key: string | string[], tryParseJson: boolean): Promise<unknown> {
        const localStorage = this._platformBridge._localStorage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (Array.isArray(key)) {
            const values = key.map((k) => this.#parseValue(localStorage.getItem(k), tryParseJson))
            return Promise.resolve(values)
        }

        return Promise.resolve(this.#parseValue(localStorage.getItem(key), tryParseJson))
    }

    #writeToLocalStorage(key: string | string[], value: unknown | unknown[]): Promise<void> {
        const localStorage = this._platformBridge._localStorage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        try {
            if (Array.isArray(key)) {
                const values = value as unknown[]
                for (let i = 0; i < key.length; i++) {
                    localStorage.setItem(key[i], this.#serializeValue(values[i]) as string)
                }
            } else {
                localStorage.setItem(key, this.#serializeValue(value) as string)
            }
            return Promise.resolve()
        } catch (error) {
            if (error && (error as Error).name === 'QuotaExceededError') {
                return Promise.reject(ERROR.STORAGE_QUOTA_EXCEEDED)
            }
            return Promise.reject(error)
        }
    }

    #deleteFromLocalStorage(key: string | string[]): Promise<void> {
        const localStorage = this._platformBridge._localStorage
        if (!localStorage) {
            return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
        }

        if (Array.isArray(key)) {
            key.forEach((k) => localStorage.removeItem(k))
        } else {
            localStorage.removeItem(key)
        }
        return Promise.resolve()
    }

    // --- cloud path ---

    async #readFromCloud(
        key: string | string[],
        tryParseJson: boolean,
        cloudMode: CloudStorageMode,
    ): Promise<unknown> {
        try {
            await this._platformBridge.cloudStorageReady
        } catch {
            return this.#readFromLocalStorage(key, tryParseJson)
        }

        const keys = Array.isArray(key) ? key : [key]

        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            await this.#ensureSnapshotLoaded()
        } else {
            await this.#ensureKeysLoadedLazy(keys)
        }

        const rawValues = keys.map((k) => {
            const fromCache = this.#cache ? this.#cache[k] : undefined
            return fromCache === undefined ? null : fromCache
        })

        const finalValues = this.#applyLocalStorageFallback(keys, rawValues)

        const parsedValues = finalValues.map((raw) => this.#parseValue(raw, tryParseJson))

        return Array.isArray(key) ? parsedValues : parsedValues[0]
    }

    #applyLocalStorageFallback(keys: string[], rawValues: unknown[]): unknown[] {
        const localStorage = this._platformBridge._localStorage
        if (!localStorage) {
            return rawValues
        }

        const migrations: MigrationEntry[] = []
        const result = rawValues.map((raw, i) => {
            if (raw !== null) {
                return raw
            }

            const localValue = localStorage.getItem(keys[i])
            if (localValue === null || localValue === undefined) {
                return raw
            }

            migrations.push({ key: keys[i], value: localValue })
            return localValue
        })

        if (migrations.length > 0) {
            this.#enqueueMigration(migrations)
        }

        return result
    }

    #enqueueMigration(migrations: MigrationEntry[]): void {
        this.#enqueueWrite(async () => {
            const cloudMode = this._platformBridge.cloudStorageMode
            const migrationKeys = migrations.map((m) => m.key)
            const migrationValues = migrations.map((m) => m.value)

            try {
                await this.#performCloudSave(migrationKeys, migrationValues, cloudMode)

                const localStorage = this._platformBridge._localStorage
                if (localStorage) {
                    migrations.forEach((m) => localStorage.removeItem(m.key))
                }

                if (!this.#cache) {
                    this.#cache = {}
                }
                for (let i = 0; i < migrationKeys.length; i++) {
                    this.#cache[migrationKeys[i]] = migrationValues[i]
                }
            } catch {
                // Migration failed: leave localStorage untouched, cache unchanged
            }
        }).catch(() => {})
    }

    async #writeToCloud(
        key: string | string[],
        value: unknown | unknown[],
        cloudMode: CloudStorageMode,
    ): Promise<void> {
        try {
            await this._platformBridge.cloudStorageReady
        } catch {
            return this.#writeToLocalStorage(key, value)
        }

        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            await this.#ensureSnapshotLoaded()
        }

        const keys = Array.isArray(key) ? key : [key]
        const values = Array.isArray(key) ? (value as unknown[]) : [value]
        const serializedValues = values.map((v) => this.#serializeValue(v))

        await this.#performCloudSave(keys, serializedValues, cloudMode)

        if (!this.#cache) {
            this.#cache = {}
        }
        for (let i = 0; i < keys.length; i++) {
            this.#cache[keys[i]] = serializedValues[i]
        }

        this.#removeFromLocalStorage(keys)
        return undefined
    }

    async #deleteFromCloud(key: string | string[], cloudMode: CloudStorageMode): Promise<void> {
        try {
            await this._platformBridge.cloudStorageReady
        } catch {
            return this.#deleteFromLocalStorage(key)
        }

        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            await this.#ensureSnapshotLoaded()
        }

        const keys = Array.isArray(key) ? key : [key]

        await this.#performCloudDelete(keys, cloudMode)

        if (this.#cache) {
            keys.forEach((k) => { delete this.#cache![k] })
        }

        this.#removeFromLocalStorage(keys)
        return undefined
    }

    #removeFromLocalStorage(keys: string[]): void {
        const localStorage = this._platformBridge._localStorage
        if (!localStorage) {
            return
        }
        keys.forEach((k) => localStorage.removeItem(k))
    }

    // --- cloud save/delete dispatch ---

    async #performCloudSave(
        keys: string[],
        values: unknown[],
        cloudMode: CloudStorageMode,
    ): Promise<void> {
        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            const snapshot: Record<string, unknown> = { ...(this.#cache || {}) }
            for (let i = 0; i < keys.length; i++) {
                snapshot[keys[i]] = values[i]
            }
            await this._platformBridge.saveCloudSnapshot(snapshot, keys)
            return
        }

        await Promise.all(keys.map((k, i) => this._platformBridge.saveCloudKey(k, values[i])))
    }

    async #performCloudDelete(keys: string[], cloudMode: CloudStorageMode): Promise<void> {
        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            const snapshot: Record<string, unknown> = { ...(this.#cache || {}) }
            keys.forEach((k) => { delete snapshot[k] })
            await this._platformBridge.deleteCloudKeys(snapshot, keys)
            return
        }

        await Promise.all(keys.map((k) => this._platformBridge.deleteCloudKey(k)))
    }

    // --- snapshot loading ---

    #ensureSnapshotLoaded(): Promise<void> {
        if (this.#cacheLoaded) {
            return Promise.resolve()
        }

        if (!this.#loadPromise) {
            this.#loadPromise = this._platformBridge.loadCloudSnapshot()
                .then((data) => {
                    this.#cache = data || {}
                    this.#cacheLoaded = true
                })
                .catch((error) => {
                    this.#loadPromise = null
                    throw error
                })
        }

        return this.#loadPromise
    }

    async #ensureKeysLoadedLazy(keys: string[]): Promise<void> {
        if (!this.#cache) {
            this.#cache = {}
        }

        const loadPromises: Promise<void>[] = []

        keys.forEach((k) => {
            if (k in this.#cache!) {
                return
            }

            const pending = this.#pendingKeyLoads.get(k)
            if (pending) {
                loadPromises.push(pending)
                return
            }

            const promise = this._platformBridge.loadCloudKey(k)
                .then((value) => {
                    this.#cache![k] = value === undefined ? null : value
                    this.#pendingKeyLoads.delete(k)
                })
                .catch((error) => {
                    this.#pendingKeyLoads.delete(k)
                    throw error
                })

            this.#pendingKeyLoads.set(k, promise)
            loadPromises.push(promise)
        })

        if (loadPromises.length > 0) {
            await Promise.all(loadPromises)
        }
    }

    // --- queue & reset ---

    #enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
        const next = this.#writeQueue
            .catch(() => {})
            .then(() => operation())
        this.#writeQueue = next.catch(() => {})
        return next
    }

    #resetCloudState(): void {
        this.#writeQueue = this.#writeQueue
            .catch(() => {})
            .then(() => {
                this.#cache = null
                this.#cacheLoaded = false
                this.#loadPromise = null
                this.#pendingKeyLoads.clear()
            })
    }

    // --- helpers ---

    #parseValue(raw: unknown, tryParseJson: boolean): unknown {
        if (raw === null || raw === undefined) {
            return null
        }

        if (!tryParseJson || typeof raw !== 'string') {
            return raw
        }

        try {
            return JSON.parse(raw)
        } catch {
            return raw
        }
    }

    #serializeValue(value: unknown): unknown {
        if (value === undefined || value === null) {
            return value
        }
        if (typeof value === 'string') {
            return value
        }
        return JSON.stringify(value)
    }
}

export default StorageModule
