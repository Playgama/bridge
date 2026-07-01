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

/**
 * Retrieves the server timestamp only once per session and derives every
 * subsequent value from the cached offset against the local clock.
 * Concurrent calls share a single in-flight retrieval; a failed retrieval is
 * not cached, so a later call may retry it.
 */
class ServerTimeCache {
    #timeDiff: number | null = null

    #pending: Promise<number> | null = null

    #retrieve: () => Promise<number>

    constructor(retrieve: () => Promise<number>) {
        this.#retrieve = retrieve
    }

    getServerTime(): Promise<number> {
        if (this.#timeDiff !== null) {
            return Promise.resolve(Date.now() + this.#timeDiff)
        }

        if (!this.#pending) {
            this.#pending = Promise.resolve()
                .then(() => this.#retrieve())
                .then((serverTime) => {
                    this.#timeDiff = serverTime - Date.now()
                    this.#pending = null
                    return serverTime
                })
                .catch((error) => {
                    this.#pending = null
                    throw error
                })
        }

        return this.#pending
    }
}

export default ServerTimeCache
