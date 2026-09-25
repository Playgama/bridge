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

import { GAMEPLAY_MILESTONES_SECONDS } from './constants'

// Sends the gameplay_<n>s events, counting only the time the game is not paused
class GameplayMilestoneTracker {
    #send: (eventName: string) => void

    #pending: number[] = []

    #timers: ReturnType<typeof setTimeout>[] = []

    #elapsed = 0

    #resumedAt = 0

    #isPaused = false

    #isStarted = false

    constructor(send: (eventName: string) => void) {
        this.#send = send
    }

    start(): void {
        if (this.#isStarted) {
            return
        }

        this.#isStarted = true
        this.#pending = [...GAMEPLAY_MILESTONES_SECONDS]

        if (!this.#isPaused) {
            this.#schedule()
        }
    }

    setPauseState(isPaused: boolean): void {
        if (this.#isPaused === isPaused) {
            return
        }

        this.#isPaused = isPaused

        if (!this.#isStarted || this.#pending.length === 0) {
            return
        }

        if (isPaused) {
            this.#elapsed += Date.now() - this.#resumedAt
            this.#clearTimers()
        } else {
            this.#schedule()
        }
    }

    #schedule(): void {
        this.#resumedAt = Date.now()

        this.#pending.forEach((seconds) => {
            const delay = Math.max(seconds * 1000 - this.#elapsed, 0)
            this.#timers.push(setTimeout(() => {
                this.#pending = this.#pending.filter((value) => value !== seconds)
                this.#send(`gameplay_${seconds}s`)
            }, delay))
        })
    }

    #clearTimers(): void {
        this.#timers.forEach((timer) => clearTimeout(timer))
        this.#timers = []
    }
}

export default GameplayMilestoneTracker
