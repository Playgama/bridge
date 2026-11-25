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
    LOADING_SCREEN_OVERLAY_ID,
    LOADING_SCREEN_PLAYGAMA_BACKGROUND_COLOR,
    LOADING_SCREEN_PLAYGAMA_IDLE_COLOR,
    LOADING_SCREEN_PLAYGAMA_ACCENT_COLOR,
    LOADING_SCREEN_PLAYGAMA_DONE_LOGO_COLOR,
    LOADING_SCREEN_PLAYGAMA_LOGO_SYMBOL_ID,
    LOADING_SCREEN_PLAYGAMA_LOGO_WIDTH,
    LOADING_SCREEN_PLAYGAMA_LOGO_HEIGHT,
    LOADING_SCREEN_PLAYGAMA_LOGO_PATHS,
    LOADING_SCREEN_PLAYGAMA_LOADING_FILL,
    LOADING_SCREEN_PLAYGAMA_LOADING_DURATION,
    LOADING_SCREEN_PLAYGAMA_LOADING_EASE,
    LOADING_SCREEN_PLAYGAMA_FINISH_BASE_DURATION,
    LOADING_SCREEN_PLAYGAMA_FINISH_EXTRA_DURATION,
    LOADING_SCREEN_PLAYGAMA_FINISH_EASE,
    LOADING_SCREEN_PLAYGAMA_FINALE_START,
    LOADING_SCREEN_PLAYGAMA_COLOR_DURATION,
    LOADING_SCREEN_PLAYGAMA_COLOR_EASE,
    LOADING_SCREEN_PLAYGAMA_BOUNCE_DURATION,
    LOADING_SCREEN_PLAYGAMA_BOUNCE_SCALE,
    LOADING_SCREEN_PLAYGAMA_FADE_OUT_DURATION,
} from './constants'
import type { LoadingScreenView } from './types'

const STATE = {
    IDLE: 'idle',
    LOADING: 'loading',
    DONE: 'done',
} as const

// Three layers of one pill, stacked: idle (white/20% ring and logo), fill (purple
// ring and logo, wiped in from the left) and done (purple pill, white logo).
// Only transform and opacity move and CSS runs every step, so the browser keeps
// animating while the game's own scripts hold the main thread.
class PlaygamaLoadingView implements LoadingScreenView {
    #overlay: HTMLDivElement | null = null

    #loader: HTMLDivElement | null = null

    #fill: HTMLDivElement | null = null

    // When the finale (colour-in and bounce) is over.
    #finishedAt = 0

    show(): void {
        this.#injectStyles()

        const logo = `<svg class="pg-loader__logo" aria-hidden="true"><use href="#${LOADING_SCREEN_PLAYGAMA_LOGO_SYMBOL_ID}"/></svg>`
        const paths = LOADING_SCREEN_PLAYGAMA_LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('')

        const overlay = document.createElement('div')
        overlay.id = LOADING_SCREEN_OVERLAY_ID
        overlay.className = 'pg-loader-overlay'
        overlay.innerHTML = `
            <svg width="0" height="0" style="position:absolute" aria-hidden="true">
                <symbol id="${LOADING_SCREEN_PLAYGAMA_LOGO_SYMBOL_ID}" viewBox="0 0 ${LOADING_SCREEN_PLAYGAMA_LOGO_WIDTH} ${LOADING_SCREEN_PLAYGAMA_LOGO_HEIGHT}">${paths}</symbol>
            </svg>
            <div class="pg-loader" role="progressbar" aria-label="Loading">
                <div class="pg-loader__layer pg-loader__idle">${logo}</div>
                <div class="pg-loader__fill">
                    <div class="pg-loader__fill-in">
                        <div class="pg-loader__layer">${logo}</div>
                    </div>
                </div>
                <div class="pg-loader__done">
                    <div class="pg-loader__layer">${logo}</div>
                </div>
            </div>
        `
        document.body.appendChild(overlay)

        this.#overlay = overlay
        this.#loader = overlay.querySelector('.pg-loader')
        this.#fill = overlay.querySelector('.pg-loader__fill')

        if (this.#loader && this.#fill) {
            this.#loader.dataset.state = STATE.IDLE
            // Commit the empty logo, so the wipe starts from zero.
            this.#fill.getBoundingClientRect()
            this.#loader.dataset.state = STATE.LOADING
        }
    }

    // The wipe runs on time, only 100% matters: it sends the wipe to the end.
    setProgress(progress: number): void {
        const loader = this.#loader
        const fill = this.#fill
        if (progress < 100 || !loader || !fill || loader.dataset.state === STATE.DONE) {
            return
        }

        const offset = new DOMMatrixReadOnly(getComputedStyle(fill).transform).m41
        const left = fill.offsetWidth > 0 ? Math.min(1, Math.max(0, -offset / fill.offsetWidth)) : 1
        const finish = Math.round(LOADING_SCREEN_PLAYGAMA_FINISH_BASE_DURATION
            + LOADING_SCREEN_PLAYGAMA_FINISH_EXTRA_DURATION * left)
        const finale = finish * LOADING_SCREEN_PLAYGAMA_FINALE_START

        this.#finishedAt = performance.now() + finale
            + Math.max(LOADING_SCREEN_PLAYGAMA_COLOR_DURATION, LOADING_SCREEN_PLAYGAMA_BOUNCE_DURATION)

        loader.style.setProperty('--pg-finish', `${finish}ms`)
        loader.dataset.state = STATE.DONE
    }

    hide(): void {
        const overlay = this.#overlay
        if (!overlay) {
            return
        }

        setTimeout(() => {
            overlay.classList.add('pg-loader-fade-out')
            setTimeout(() => overlay.remove(), LOADING_SCREEN_PLAYGAMA_FADE_OUT_DURATION)
        }, Math.max(0, this.#finishedAt - performance.now()))
    }

    #injectStyles(): void {
        const style = document.createElement('style')
        style.textContent = `
            .pg-loader-overlay {
                position: absolute;
                top: 0px;
                left: 0px;
                width: 100vw;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${LOADING_SCREEN_PLAYGAMA_BACKGROUND_COLOR};
                z-index: 9999999;
                transition: opacity ${LOADING_SCREEN_PLAYGAMA_FADE_OUT_DURATION}ms ease;
            }

            .pg-loader-fade-out {
                opacity: 0;
            }

            .pg-loader {
                --pg-fill: 0;
                --pg-time: 0s;
                --pg-ease: linear;
                --pg-finish: ${LOADING_SCREEN_PLAYGAMA_FINISH_BASE_DURATION + LOADING_SCREEN_PLAYGAMA_FINISH_EXTRA_DURATION}ms;
                --pg-finale: calc(var(--pg-finish) * ${LOADING_SCREEN_PLAYGAMA_FINALE_START});
                /* One mockup pixel: 1/600 of the view's smaller side. */
                --pg-u: calc(100vmin / 600);
                position: relative;
                flex: none;
                width: calc(357.5 * var(--pg-u));
                height: calc(100 * var(--pg-u));
                overflow: hidden;
            }

            .pg-loader__layer {
                position: absolute;
                inset: 0;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                border: max(3px, calc(4 * var(--pg-u))) solid;
                border-radius: 1000px;
            }

            .pg-loader__logo {
                display: block;
                flex: none;
                width: calc(${LOADING_SCREEN_PLAYGAMA_LOGO_WIDTH} * var(--pg-u));
                height: calc(${LOADING_SCREEN_PLAYGAMA_LOGO_HEIGHT} * var(--pg-u));
                fill: currentColor;
            }

            .pg-loader__idle {
                color: ${LOADING_SCREEN_PLAYGAMA_IDLE_COLOR};
            }

            /* The boxes that move or fade size nothing from the view themselves:
               otherwise Safari drops their transition when the view is resized. */
            .pg-loader__fill,
            .pg-loader__fill-in,
            .pg-loader__done {
                position: absolute;
                inset: 0;
            }

            /* The wipe: a window slides in from the left while the box inside it
               slides back by as much, so only the window's edge moves. */
            .pg-loader__fill {
                overflow: hidden;
                transform: translateX(calc((var(--pg-fill) - 1) * 100%));
            }

            .pg-loader__fill-in {
                color: ${LOADING_SCREEN_PLAYGAMA_ACCENT_COLOR};
                transform: translateX(calc((1 - var(--pg-fill)) * 100%));
            }

            .pg-loader__fill,
            .pg-loader__fill-in {
                transition: transform var(--pg-time) var(--pg-ease);
            }

            .pg-loader__done {
                color: ${LOADING_SCREEN_PLAYGAMA_DONE_LOGO_COLOR};
                opacity: 0;
            }

            .pg-loader__done .pg-loader__layer {
                border-color: transparent;
                background: ${LOADING_SCREEN_PLAYGAMA_ACCENT_COLOR};
            }

            .pg-loader[data-state="${STATE.LOADING}"] {
                --pg-fill: ${LOADING_SCREEN_PLAYGAMA_LOADING_FILL};
                --pg-time: ${LOADING_SCREEN_PLAYGAMA_LOADING_DURATION}ms;
                --pg-ease: ${LOADING_SCREEN_PLAYGAMA_LOADING_EASE};
            }

            .pg-loader[data-state="${STATE.DONE}"] {
                --pg-fill: 1;
                --pg-time: var(--pg-finish);
                --pg-ease: ${LOADING_SCREEN_PLAYGAMA_FINISH_EASE};
                animation: pg-loader-pop ${LOADING_SCREEN_PLAYGAMA_BOUNCE_DURATION}ms var(--pg-finale) both;
            }

            .pg-loader[data-state="${STATE.DONE}"] .pg-loader__done {
                opacity: 1;
                transition: opacity ${LOADING_SCREEN_PLAYGAMA_COLOR_DURATION}ms ${LOADING_SCREEN_PLAYGAMA_COLOR_EASE} var(--pg-finale);
            }

            .pg-loader[data-state="${STATE.DONE}"] .pg-loader__idle,
            .pg-loader[data-state="${STATE.DONE}"] .pg-loader__fill {
                animation: pg-loader-hide 0s calc(var(--pg-finale) + ${LOADING_SCREEN_PLAYGAMA_COLOR_DURATION}ms) forwards;
            }

            @keyframes pg-loader-pop {
                0% { transform: scale(1); animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1); }
                33% { transform: scale(${LOADING_SCREEN_PLAYGAMA_BOUNCE_SCALE}); animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1); }
                100% { transform: scale(1); }
            }

            @keyframes pg-loader-hide {
                to { visibility: hidden; }
            }

            @media (prefers-reduced-motion: reduce) {
                .pg-loader[data-state="${STATE.DONE}"] {
                    animation: none;
                }
            }
        `
        document.head.appendChild(style)
    }
}

export default PlaygamaLoadingView
