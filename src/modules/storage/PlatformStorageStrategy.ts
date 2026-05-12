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

import { CLOUD_STORAGE_MODE, type CloudStorageMode } from './constants'
import { parseValue, serializeValue } from './helpers'
import type LocalStorageStrategy from './LocalStorageStrategy'
import type { StorageBridgeContract } from './types'

interface MigrationEntry {
    key: string
    value: string
}

class PlatformStorageStrategy {
    #bridge: StorageBridgeContract

    #localStrategy: LocalStorageStrategy

    #cache: Record<string, unknown> | null = null

    #cacheLoaded = false

    #loadPromise: Promise<void> | null = null

    #pendingKeyLoads: Map<string, Promise<void>> = new Map()

    #writeQueue: Promise<unknown> = Promise.resolve()

    constructor(bridge: StorageBridgeContract, localStrategy: LocalStorageStrategy) {
        this.#bridge = bridge
        this.#localStrategy = localStrategy
    }

    async read(
        key: string | string[],
        tryParseJson: boolean,
        cloudMode: CloudStorageMode,
    ): Promise<unknown> {
        try {
            await this.#bridge.cloudStorageReady
        } catch {
            return this.#localStrategy.read(key, tryParseJson)
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

        const parsedValues = finalValues.map((raw) => parseValue(raw, tryParseJson))

        return Array.isArray(key) ? parsedValues : parsedValues[0]
    }

    write(
        key: string | string[],
        value: unknown | unknown[],
        cloudMode: CloudStorageMode,
    ): Promise<void> {
        return this.#enqueueWrite(() => this.#write(key, value, cloudMode)) as Promise<void>
    }

    delete(key: string | string[], cloudMode: CloudStorageMode): Promise<void> {
        return this.#enqueueWrite(() => this.#delete(key, cloudMode)) as Promise<void>
    }

    reset(): void {
        this.#writeQueue = this.#writeQueue
            .catch(() => {})
            .then(() => {
                this.#cache = null
                this.#cacheLoaded = false
                this.#loadPromise = null
                this.#pendingKeyLoads.clear()
            })
    }

    async #write(
        key: string | string[],
        value: unknown | unknown[],
        cloudMode: CloudStorageMode,
    ): Promise<void> {
        try {
            await this.#bridge.cloudStorageReady
        } catch {
            return this.#localStrategy.write(key, value)
        }

        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            await this.#ensureSnapshotLoaded()
        }

        const keys = Array.isArray(key) ? key : [key]
        const values = Array.isArray(key) ? (value as unknown[]) : [value]
        const serializedValues = values.map((v) => serializeValue(v))

        await this.#performCloudSave(keys, serializedValues, cloudMode)

        if (!this.#cache) {
            this.#cache = {}
        }
        for (let i = 0; i < keys.length; i++) {
            this.#cache[keys[i]] = serializedValues[i]
        }

        this.#localStrategy.removeMany(keys)
        return undefined
    }

    async #delete(key: string | string[], cloudMode: CloudStorageMode): Promise<void> {
        try {
            await this.#bridge.cloudStorageReady
        } catch {
            return this.#localStrategy.delete(key)
        }

        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            await this.#ensureSnapshotLoaded()
        }

        const keys = Array.isArray(key) ? key : [key]

        await this.#performCloudDelete(keys, cloudMode)

        if (this.#cache) {
            keys.forEach((k) => { delete this.#cache![k] })
        }

        this.#localStrategy.removeMany(keys)
        return undefined
    }

    #applyLocalStorageFallback(keys: string[], rawValues: unknown[]): unknown[] {
        const localStorage = this.#localStrategy.storage
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
            const cloudMode = this.#bridge.cloudStorageMode
            const migrationKeys = migrations.map((m) => m.key)
            const migrationValues = migrations.map((m) => m.value)

            try {
                await this.#performCloudSave(migrationKeys, migrationValues, cloudMode)

                this.#localStrategy.removeMany(migrationKeys)

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
            await this.#bridge.saveCloudSnapshot(snapshot, keys)
            return
        }

        await Promise.all(keys.map((k, i) => this.#bridge.saveCloudKey(k, values[i])))
    }

    async #performCloudDelete(keys: string[], cloudMode: CloudStorageMode): Promise<void> {
        if (cloudMode === CLOUD_STORAGE_MODE.EAGER) {
            const snapshot: Record<string, unknown> = { ...(this.#cache || {}) }
            keys.forEach((k) => { delete snapshot[k] })
            await this.#bridge.deleteCloudKeys(snapshot, keys)
            return
        }

        await Promise.all(keys.map((k) => this.#bridge.deleteCloudKey(k)))
    }

    #ensureSnapshotLoaded(): Promise<void> {
        if (this.#cacheLoaded) {
            return Promise.resolve()
        }

        if (!this.#loadPromise) {
            this.#loadPromise = this.#bridge.loadCloudSnapshot()
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

            const promise = this.#bridge.loadCloudKey(k)
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

    #enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
        const next = this.#writeQueue
            .catch(() => {})
            .then(() => operation())
        this.#writeQueue = next.catch(() => {})
        return next
    }
}

export default PlatformStorageStrategy
