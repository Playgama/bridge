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

// Runs a flush at most once per interval. The first request after a quiet period runs on the
// next tick (so a burst of synchronous writes still goes out as one), later requests wait for
// the interval to pass. flushNow() skips the wait, e.g. when the page is being hidden.
class FlushScheduler {
    #flush: () => void

    #interval: number

    #timer: ReturnType<typeof setTimeout> | null = null

    #lastFlushTime = 0

    constructor(flush: () => void, interval: number) {
        this.#flush = flush
        this.#interval = interval
    }

    schedule(): void {
        if (this.#timer !== null) {
            return
        }

        const delay = Math.max(0, this.#lastFlushTime + this.#interval - Date.now())
        this.#timer = setTimeout(() => this.flushNow(), delay)
    }

    flushNow(): void {
        if (this.#timer !== null) {
            clearTimeout(this.#timer)
            this.#timer = null
        }

        this.#lastFlushTime = Date.now()
        this.#flush()
    }
}

export default FlushScheduler
