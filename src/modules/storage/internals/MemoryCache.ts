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

import { isEmpty } from '../helpers'

// In-memory mirror of the active store (cloud or local). Holds only present, serialized
// values — the same shape that gets persisted; a missing key means "unknown" and triggers a
// load. Each key it knows about is in one of three states:
//   - clean:   a value confirmed in the cloud;
//   - dirty:   a value that is only in local storage so far (a pending write to push up);
//   - deleted: a tombstone for a key removed locally while the cloud was unreachable (a pending
//              delete to push up). Tombstones are not present values, so reads see them as gone.
//
// Every storage operation runs one at a time through the queue, so the cache is only ever
// touched by a single operation and needs no epochs, locks or in-flight de-duplication.
class MemoryCache {
    #data = new Map<string, unknown>()

    // Present keys whose value is only in local storage, not yet confirmed in the cloud.
    #dirty = new Set<string>()

    // Tombstones: keys deleted locally that still need to be deleted from the cloud.
    #deleted = new Set<string>()

    has(key: string): boolean {
        return this.#data.has(key)
    }

    get(key: string): unknown {
        return this.#data.get(key)
    }

    isDirty(key: string): boolean {
        return this.#dirty.has(key)
    }

    isDeleted(key: string): boolean {
        return this.#deleted.has(key)
    }

    dirtyKeys(): string[] {
        return [...this.#dirty]
    }

    deletedKeys(): string[] {
        return [...this.#deleted]
    }

    // Records a cloud-confirmed value (clears any pending state).
    set(key: string, value: unknown): void {
        if (isEmpty(value)) {
            this.delete(key)
            return
        }
        this.#data.set(key, value)
        this.#dirty.delete(key)
        this.#deleted.delete(key)
    }

    // Records a value that lives only in local storage so far (marks it dirty).
    setDirty(key: string, value: unknown): void {
        if (isEmpty(value)) {
            this.delete(key)
            return
        }
        this.#data.set(key, value)
        this.#dirty.add(key)
        this.#deleted.delete(key)
    }

    // Forgets a key entirely, with no pending cloud delete (the cloud already agrees).
    delete(key: string): void {
        this.#data.delete(key)
        this.#dirty.delete(key)
        this.#deleted.delete(key)
    }

    // Removes a key and remembers to delete it from the cloud on the next sync.
    tombstone(key: string): void {
        this.#data.delete(key)
        this.#dirty.delete(key)
        this.#deleted.add(key)
    }

    keys(): string[] {
        return [...this.#data.keys()]
    }

    // Drops everything. Used once local changes are safely in the cloud, so the next read
    // rebuilds the cache straight from the cloud.
    clear(): void {
        this.#data.clear()
        this.#dirty.clear()
        this.#deleted.clear()
    }
}

export default MemoryCache
