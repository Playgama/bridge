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

import EventLite from 'event-lite'

export const EVENT_NAME = {
    STATE_CHANGED: 'state_changed',
    TIME_LEFT_CHANGED: 'time_left_changed',
}

export const STATE = {
    CREATED: 'created',
    STARTED: 'started',
    STOPPED: 'stopped',
    COMPLETED: 'completed',
}

class Timer {
    get state() {
        return this.#state
    }

    #time = 0

    #timeLeft = 0

    #state = STATE.CREATED

    #intervalId = 0

    constructor(time) {
        this.#time = time
    }

    start() {
        if (this.#state === STATE.STARTED) {
            return
        }

        this.#timeLeft = this.#time
        this.#setState(STATE.STARTED)
        this.#intervalId = setInterval(() => {
            this.#timeLeft -= 1
            this.emit(EVENT_NAME.TIME_LEFT_CHANGED, this.#timeLeft)

            if (this.#timeLeft <= 0) {
                this.#clear()
                this.#setState(STATE.COMPLETED)
            }
        }, 1000)
    }

    stop() {
        this.#clear()

        if (this.#state === STATE.STARTED) {
            this.#setState(STATE.STOPPED)
        }
    }

    #setState(value) {
        this.#state = value
        this.emit(EVENT_NAME.STATE_CHANGED, this.#state)
    }

    #clear() {
        clearInterval(this.#intervalId)
        this.#timeLeft = 0
    }
}

EventLite.mixin(Timer.prototype)
export default Timer
