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

import Deferred from '../Deferred'
import logger from '../logger'
import type { LoadingSoundConfig } from '../bridge-config/types'

// Branded sound played once alongside the loading screen. The file is fetched
// as soon as the instance is created, so playback can start the moment the
// platform reports its audio state.
class LoadingSound {
    // Resolves when the sound has finished, failed or was cancelled. Never rejects,
    // so the loading screen can always be hidden.
    get finished(): Promise<void> {
        return this.#finished.promise
    }

    #audio: HTMLAudioElement

    #finished = new Deferred<void>()

    #isSettled = false

    constructor({ url }: LoadingSoundConfig) {
        this.#audio = new Audio(url)
        this.#audio.preload = 'auto'
        this.#audio.addEventListener('ended', () => this.#settle())
        this.#audio.addEventListener('error', () => this.#settle(`Loading sound failed to load: ${url}`))
        this.#audio.load()
    }

    play(): void {
        if (this.#isSettled) {
            return
        }

        this.#audio.play().catch((error) => {
            this.#settle(`Loading sound playback rejected: ${error?.message || String(error)}`)
        })
    }

    cancel(): void {
        this.#audio.pause()
        this.#settle()
    }

    #settle(warning?: string): void {
        if (this.#isSettled) {
            return
        }

        this.#isSettled = true

        if (warning) {
            logger.warn(warning)
        }

        this.#finished.resolve()
    }
}

export default LoadingSound
