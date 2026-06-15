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

import type { PlatformBridgeLike } from '../ModuleBase'

// Cloud storage contract each platform implements itself. Values are serialized strings by the
// time they reach a platform; how a platform actually stores them (per key, or as one blob it
// has to read-modify-write) is entirely the platform's business — the module stays agnostic.
export interface StorageBridgeContract extends PlatformBridgeLike {
    // Whether the platform can currently persist to its cloud storage (e.g. the player is
    // authorized). Flipping this emits PLATFORM_STORAGE_AVAILABILITY_CHANGED.
    isPlatformStorageAvailable: boolean
    // Loads the given keys. Returns a map of key -> value for the keys that exist; a platform
    // that loads its whole dataset at once may return more keys, which the module also caches.
    // Keys absent in the cloud are omitted.
    getDataFromStorage(keys: string[]): Promise<Record<string, unknown>>
    // Persists the given key -> value writes.
    setDataToStorage(data: Record<string, unknown>): Promise<void>
    // Deletes the given keys.
    deleteDataFromStorage(keys: string[]): Promise<void>
    // Optional, best-effort hook the module calls after it persists a batch to LOCAL storage
    // (i.e. while cloud storage is unavailable). Lets a platform mirror local/guest writes to a
    // secondary backend. Fire-and-forget — its result is ignored.
    notifyLocalDataChanged?(batch: WriteBatch): void
}

// A single set entry. Its value is already serialized by the time it reaches a backend.
export interface StorageEntry {
    key: string
    value: unknown
}

// Canonical form of any mutation: StorageModule turns every set/delete call into this.
export interface WriteBatch {
    sets: StorageEntry[]
    deletes: string[]
}
