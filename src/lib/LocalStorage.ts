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

class LocalStorage {
    get isAvailable(): boolean {
        return this.#storage !== null
    }

    #storage: Storage | null = null

    constructor() {
        try {
            this.#storage = window.localStorage
        } catch {
            this.#storage = null
        }
    }

    getItem(key: string): string | null {
        if (!this.#storage) {
            return null
        }

        try {
            return this.#storage.getItem(key)
        } catch {
            return null
        }
    }

    setItem(key: string, value: string): void {
        if (!this.#storage) {
            return
        }

        this.#storage.setItem(key, value)
    }

    removeItem(key: string): void {
        if (!this.#storage) {
            return
        }

        try {
            this.#storage.removeItem(key)
        } catch {
            // ignore
        }
    }
}

export default new LocalStorage()
