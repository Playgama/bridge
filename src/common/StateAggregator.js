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

class StateAggregator {
    #states = {}

    #aggregatedState = false

    #callback = null

    constructor(stateKeys, callback) {
        this.#callback = callback

        stateKeys.forEach((key) => {
            this.#states[key] = false
        })
    }

    setState(key, value) {
        if (!(key in this.#states) || typeof value !== 'boolean') {
            return
        }

        if (this.#states[key] === value) {
            return
        }

        this.#states[key] = value
        this.#emitIfChanged()
    }

    getState(key) {
        if (!(key in this.#states)) {
            return false
        }

        return this.#states[key]
    }

    getAggregatedState() {
        return this.#aggregatedState
    }

    resetAll() {
        Object.keys(this.#states).forEach((key) => {
            this.#states[key] = false
        })

        this.#emitIfChanged()
    }

    #emitIfChanged() {
        const newAggregatedState = Object.values(this.#states).some((value) => value === true)

        if (this.#aggregatedState !== newAggregatedState) {
            this.#aggregatedState = newAggregatedState
            this.#callback(this.#aggregatedState)
        }
    }
}

export default StateAggregator
