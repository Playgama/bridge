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
    LOADING_SCREEN_RING_BACKGROUND_COLOR,
    LOADING_SCREEN_RING_COLOR,
    LOADING_SCREEN_RING_TEXT_COLOR,
    LOADING_SCREEN_RING_VIEWBOX_SIZE,
    LOADING_SCREEN_RING_CENTER,
    LOADING_SCREEN_RING_RADIUS,
    LOADING_SCREEN_RING_HEAD_WIDTH,
    LOADING_SCREEN_RING_STEPS,
    LOADING_SCREEN_RING_APPEAR_DELAY,
    LOADING_SCREEN_RING_CLOSE_DURATION,
    LOADING_SCREEN_RING_FADE_OUT_DURATION,
    LOADING_SCREEN_RING_FONT_FAMILY,
    LOADING_SCREEN_RING_FONT_URL,
} from './constants'
import type { LoadingScreenView } from './types'

const easeInOut = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2)

// Tilted spinning "snake" ring with a percent counter in the middle. The snake is
// drawn clockwise from a thin transparent tail to a cut-off head; at 100% the head
// catches up with the tail and the ring closes before the screen fades out.
class RingLoadingView implements LoadingScreenView {
    #overlay: HTMLDivElement | null = null

    #ring: HTMLDivElement | null = null

    #path: SVGPathElement | null = null

    #percent: HTMLDivElement | null = null

    show(): void {
        this.#injectStyles()

        const overlay = document.createElement('div')
        overlay.id = LOADING_SCREEN_OVERLAY_ID
        overlay.className = 'ring-loading-overlay'
        overlay.innerHTML = `
            <div class="ring-loading-orbit">
                <div class="ring-loading-ring">
                    <svg viewBox="0 0 ${LOADING_SCREEN_RING_VIEWBOX_SIZE} ${LOADING_SCREEN_RING_VIEWBOX_SIZE}">
                        <path fill="${LOADING_SCREEN_RING_COLOR}"/>
                    </svg>
                </div>
            </div>
            <div class="ring-loading-percent">0%</div>
        `
        document.body.appendChild(overlay)

        this.#overlay = overlay
        this.#ring = overlay.querySelector('.ring-loading-ring')
        this.#path = overlay.querySelector('path')
        this.#percent = overlay.querySelector('.ring-loading-percent')
        this.#build(0)
    }

    setProgress(progress: number): void {
        if (this.#percent) {
            this.#percent.textContent = `${Math.floor(progress)}%`
        }
    }

    hide(): void {
        const overlay = this.#overlay
        if (!overlay) {
            return
        }

        const start = performance.now()
        const tick = (now: number): void => {
            const t = Math.min((now - start) / LOADING_SCREEN_RING_CLOSE_DURATION, 1)
            this.#build(easeInOut(t))

            if (t < 1) {
                requestAnimationFrame(tick)
                return
            }

            overlay.classList.add('ring-loading-fade-out')
            setTimeout(() => overlay.remove(), LOADING_SCREEN_RING_FADE_OUT_DURATION)
        }

        requestAnimationFrame(tick)
    }

    // Rebuilds the snake path. `close` goes from 0 (snake) to 1 (closed ring): the tail
    // grows to the head width while the transparent part of the mask shrinks to the tail.
    #build(close: number): void {
        if (!this.#ring || !this.#path) {
            return
        }

        const c = LOADING_SCREEN_RING_CENTER
        const r = LOADING_SCREEN_RING_RADIUS
        const head = LOADING_SCREEN_RING_HEAD_WIDTH
        const steps = LOADING_SCREEN_RING_STEPS
        const tail = 1 + (head - 1) * close
        const outer: string[] = []
        const inner: string[] = []

        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const angle = t * 2 * Math.PI
            const w = (tail + (head - tail) * t) / 2
            const sin = Math.sin(angle)
            const cos = Math.cos(angle)
            outer.push(`${(c + (r + w) * sin).toFixed(2)} ${(c - (r + w) * cos).toFixed(2)}`)
            inner.push(`${(c + (r - w) * sin).toFixed(2)} ${(c - (r - w) * cos).toFixed(2)}`)
        }

        this.#path.setAttribute('d', `M${outer.join(' L')} L${inner.reverse().join(' L')} Z`)
        this.#ring.style.setProperty('--head-end', `${360 * (1 - close)}deg`)
    }

    #injectStyles(): void {
        const style = document.createElement('style')
        style.textContent = `
            @font-face {
                font-family: '${LOADING_SCREEN_RING_FONT_FAMILY}';
                font-style: normal;
                font-weight: 400 500;
                src: url(${LOADING_SCREEN_RING_FONT_URL}) format('woff2');
            }

            .ring-loading-overlay {
                --ring-size: min(346px, 80vmin);
                position: absolute;
                top: 0px;
                left: 0px;
                width: 100vw;
                height: 100vh;
                background: ${LOADING_SCREEN_RING_BACKGROUND_COLOR};
                z-index: 9999999;
                transition: opacity ${LOADING_SCREEN_RING_FADE_OUT_DURATION}ms ease;
            }

            .ring-loading-fade-out {
                opacity: 0;
            }

            .ring-loading-orbit {
                position: absolute;
                inset: 0;
                margin: auto;
                width: var(--ring-size);
                height: var(--ring-size);
                animation: ringLoadingOrbit 3000ms linear ${LOADING_SCREEN_RING_APPEAR_DELAY}ms infinite;
            }

            .ring-loading-ring {
                width: 100%;
                height: 100%;
                -webkit-mask: conic-gradient(from 0deg, transparent 0deg, #000 var(--head-end, 360deg));
                mask: conic-gradient(from 0deg, transparent 0deg, #000 var(--head-end, 360deg));
                transform: perspective(864px) rotateX(60deg);
                opacity: 0;
                animation:
                    ringLoadingAppear 285ms ease-out ${LOADING_SCREEN_RING_APPEAR_DELAY}ms forwards,
                    ringLoadingSpin 1100ms linear ${LOADING_SCREEN_RING_APPEAR_DELAY}ms infinite;
            }

            .ring-loading-ring svg {
                display: block;
                width: 100%;
                height: 100%;
            }

            .ring-loading-percent {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-family: '${LOADING_SCREEN_RING_FONT_FAMILY}', sans-serif;
                font-weight: 500;
                font-size: calc(var(--ring-size) * 0.139);
                line-height: 1;
                font-variant-numeric: tabular-nums;
                color: ${LOADING_SCREEN_RING_TEXT_COLOR};
                opacity: 0;
                animation: ringLoadingAppear 285ms ease-out ${LOADING_SCREEN_RING_APPEAR_DELAY}ms forwards;
            }

            @keyframes ringLoadingSpin {
                from { transform: perspective(864px) rotateX(60deg) rotateZ(0deg); }
                to { transform: perspective(864px) rotateX(60deg) rotateZ(360deg); }
            }

            @keyframes ringLoadingOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(-360deg); }
            }

            @keyframes ringLoadingAppear {
                to { opacity: 1; }
            }
        `
        document.head.appendChild(style)
    }
}

export default RingLoadingView
