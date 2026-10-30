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

import {
    LOADING_SCREEN_TYPE,
    LOADING_LOGO_TYPE,
    LOADING_SCREEN_LOGO_PRESETS,
    LOADING_SCREEN_HIDE_GATE_TIMEOUT,
    type LoadingScreenType,
    type LoadingLogoType,
} from './constants'
import type { LoadingScreenView } from './types'
import LogoLoadingView from './LogoLoadingView'
import RingLoadingView from './RingLoadingView'

export interface LoadingScreenOptions {
    type?: LoadingScreenType
    logo?: LoadingLogoType
    showLoadingText?: boolean
}

class LoadingScreen {
    #view: LoadingScreenView | null = null

    #currentProgress: number | null = null

    #completed = false

    #hideGate: Promise<unknown> | null = null

    // Delays hiding the screen until the given promise settles. Used to keep the
    // logo at 100% while the branded loading sound is still playing.
    setHideGate(gate: Promise<unknown>): void {
        this.#hideGate = gate
    }

    show({
        type = LOADING_SCREEN_TYPE.LOGO,
        logo = LOADING_LOGO_TYPE.FULL,
        showLoadingText = false,
    }: LoadingScreenOptions = {}): void {
        const preset = LOADING_SCREEN_LOGO_PRESETS[logo] ?? LOADING_SCREEN_LOGO_PRESETS[LOADING_LOGO_TYPE.FULL]
        this.#view = type === LOADING_SCREEN_TYPE.RING
            ? new RingLoadingView()
            : new LogoLoadingView(preset, showLoadingText)
        this.#view.show()
    }

    setProgress(percent: number, isFallback = false): void {
        if (this.#completed || !this.#view) {
            return
        }

        if (isFallback && this.#currentProgress !== null) {
            return
        }

        this.#currentProgress = percent

        const progress = Math.max(0, Math.min(100, percent))
        const view = this.#view
        view.setProgress(progress)

        if (progress === 100) {
            this.#completed = true

            if (this.#hideGate) {
                const timeout = new Promise((resolve) => {
                    setTimeout(resolve, LOADING_SCREEN_HIDE_GATE_TIMEOUT)
                })
                Promise.race([this.#hideGate.catch(() => {}), timeout]).then(() => view.hide())
            } else {
                view.hide()
            }
        }
    }
}

export default LoadingScreen
