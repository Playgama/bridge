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

// Runs operations one at a time in the order they were enqueued. Because reads, writes,
// deletes and availability migrations all share this queue, each one observes the effects of
// everything queued before it (read-your-writes), and the cache is never mutated concurrently.
// A failed operation rejects its own promise but never breaks the chain.
class OperationQueue {
    #tail: Promise<unknown> = Promise.resolve()

    enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.#tail.then(operation, operation)
        this.#tail = result.then(() => {}, () => {})
        return result
    }
}

export default OperationQueue
