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

// Runtime copy of the active store. For every key it knows, it holds the current value (null
// means "no data") and, once the cloud has been read or written for that key, the value the
// cloud holds. A key whose current value differs from the cloud one, or whose cloud value is not
// known yet, is dirty: it still has to be sent. A key the cache does not know triggers a load.
//
// Every storage operation runs one at a time through the queue, so the cache is only ever
// touched by a single operation.
class MemoryCache {
    #values = new Map<string, unknown>()

    #synced = new Map<string, unknown>()

    has(key: string): boolean {
        return this.#values.has(key)
    }

    get(key: string): unknown {
        return this.#values.get(key) ?? null
    }

    keys(): string[] {
        return [...this.#values.keys()]
    }

    // Records a change made by the game.
    set(key: string, value: unknown): void {
        this.#values.set(key, isEmpty(value) ? null : value)
    }

    // Records a value read from the cloud. An unsent change of the key is kept.
    load(key: string, value: unknown): void {
        const normalized = isEmpty(value) ? null : value
        if (!this.isDirty(key)) {
            this.#values.set(key, normalized)
        }
        this.#synced.set(key, normalized)
    }

    // Records that the current value of the key has been sent to the cloud.
    confirm(key: string): void {
        this.#synced.set(key, this.get(key))
    }

    isDirty(key: string): boolean {
        return this.#values.has(key)
            && (!this.#synced.has(key) || this.#synced.get(key) !== this.#values.get(key))
    }

    dirtyKeys(): string[] {
        return this.keys().filter((key) => this.isDirty(key))
    }

    clear(): void {
        this.#values.clear()
        this.#synced.clear()
    }
}

export default MemoryCache
