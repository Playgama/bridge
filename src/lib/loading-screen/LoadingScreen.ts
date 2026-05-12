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
    LOADING_SCREEN_DEFAULT_PRESET,
    LOADING_SCREEN_FULL_BRIDGE_PRESET,
    LOADING_SCREEN_HINTS,
    LOADING_SCREEN_OVERLAY_ID,
    LOADING_SCREEN_LOGO_ID,
    LOADING_SCREEN_FILL_RECT_ID,
    LOADING_SCREEN_GRADIENT_MOVER_ID,
    LOADING_SCREEN_HINT_ID,
    type ProgressLogoPreset,
} from './constants'

export interface LoadingScreenOptions {
    showFullLogo?: boolean
    showLoadingText?: boolean
}

class LoadingScreen {
    #currentProgress: number | null = null

    #completed = false

    show({ showFullLogo = false, showLoadingText = false }: LoadingScreenOptions = {}): void {
        this.#injectStyles()
        const overlay = this.#createOverlay()
        const preset = showFullLogo ? LOADING_SCREEN_FULL_BRIDGE_PRESET : LOADING_SCREEN_DEFAULT_PRESET
        overlay.appendChild(this.#createSvg(preset))

        if (showLoadingText) {
            this.#attachHints(overlay)
        }
    }

    setProgress(percent: number, isFallback = false): void {
        if (this.#completed) {
            return
        }

        if (isFallback && this.#currentProgress !== null) {
            return
        }

        const fill = document.getElementById(LOADING_SCREEN_FILL_RECT_ID)
        const gradientMover = document.getElementById(LOADING_SCREEN_GRADIENT_MOVER_ID)
        const logo = document.getElementById(LOADING_SCREEN_LOGO_ID)
        const overlay = document.getElementById(LOADING_SCREEN_OVERLAY_ID)

        if (!fill || !gradientMover || !logo || !overlay) {
            return
        }

        this.#currentProgress = percent

        const progress = Math.max(0, Math.min(100, percent))
        const translateY = 100 - progress
        fill.style.transform = `translateY(${translateY}%)`

        if (progress === 100) {
            this.#completed = true

            setTimeout(() => {
                fill.style.display = 'none'
                gradientMover.style.display = 'block'
                gradientMover.classList.add('gradient-mover')
            }, 400)
            setTimeout(() => logo.classList.add('logo-fade-out'), 900)
            setTimeout(() => overlay.remove(), 1400)
        } else {
            gradientMover.classList.remove('gradient-mover')
        }
    }

    #injectStyles(): void {
        const style = document.createElement('style')
        style.textContent = `
            .fullscreen {
                background: #242424;
                width: 100vw;
                height: 100vh;
                position: absolute;
                top: 0px;
                left: 0px;
            }

            #${LOADING_SCREEN_OVERLAY_ID} {
                font-size: 20px;
                z-index: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }

            #${LOADING_SCREEN_LOGO_ID} {
                width: 10%;
                max-width: 300px;
                min-width: 120px;
                overflow: visible;
            }

            #${LOADING_SCREEN_HINT_ID} {
                width: 8%;
                max-width: 240px;
                min-width: 96px;
                margin-top: clamp(17px, 1.7vw, 33px);
                text-align: center;
                color: #aa76ff;
                font-size: clamp(11px, 1.3vw, 16px);
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                letter-spacing: 0.04em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: opacity 0.4s ease;
            }

            .fill-rect {
                transform: translateY(100%);
                transition: transform 0.3s ease-out;
            }

            #${LOADING_SCREEN_GRADIENT_MOVER_ID} {
                display: none;
            }

            .gradient-mover {
                animation: moveGradient 0.4s linear;
            }

            @keyframes moveGradient {
                0% { transform: translateX(0); }
                100% { transform: translateX(-250%); }
            }

            .logo-fade-out {
                animation: logoFadeOut 1s linear;
            }

            .logo-fade-out path {
                fill: white;
                stroke: white;
            }

            @keyframes logoFadeOut {
                0% { opacity: 1; }
                50% { opacity: 0; }
                100% { opacity: 0; }
            }
        `
        document.head.appendChild(style)
    }

    #createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div')
        overlay.id = LOADING_SCREEN_OVERLAY_ID
        overlay.className = 'fullscreen'
        document.body.appendChild(overlay)
        return overlay
    }

    #createSvg(preset: ProgressLogoPreset): SVGSVGElement {
        const gradientWidthMultiplier = preset.gradientWidthMultiplier ?? 4
        const [, , vbWidthStr, vbHeightStr] = preset.viewBox.split(/[ ,]+/)
        const vbWidth = Number(vbWidthStr)
        const vbHeight = Number(vbHeightStr)

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('id', LOADING_SCREEN_LOGO_ID)
        svg.setAttribute('viewBox', preset.viewBox)
        svg.setAttribute('fill', 'none')
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

        const defs = document.createElementNS(svg.namespaceURI, 'defs')

        const mask = document.createElementNS(svg.namespaceURI, 'mask')
        mask.setAttribute('id', 'logo-mask')

        const blackRect = document.createElementNS(svg.namespaceURI, 'rect')
        blackRect.setAttribute('x', '0')
        blackRect.setAttribute('y', '0')
        blackRect.setAttribute('width', '100%')
        blackRect.setAttribute('height', '100%')
        blackRect.setAttribute('fill', 'black')
        mask.appendChild(blackRect)

        preset.paths.forEach((item) => {
            const path = document.createElementNS(svg.namespaceURI, 'path')
            path.setAttribute('d', typeof item === 'string' ? item : item.d)
            path.setAttribute('fill', (typeof item === 'object' && item.maskFill) ? item.maskFill : 'white')
            if (typeof item === 'object' && item.fillRule) {
                path.setAttribute('fill-rule', item.fillRule)
            }
            mask.appendChild(path)
        })

        defs.appendChild(mask)

        const gradient = document.createElementNS(svg.namespaceURI, 'linearGradient')
        gradient.setAttribute('id', 'shineGradient')
        gradient.setAttribute('x1', String(vbWidth * 2))
        gradient.setAttribute('y1', '0')
        gradient.setAttribute('x2', String(vbWidth * 3))
        gradient.setAttribute('y2', String(vbHeight))
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse')

        preset.gradientStops.forEach(({ offset, color }) => {
            const stop = document.createElementNS(svg.namespaceURI, 'stop')
            stop.setAttribute('offset', offset)
            stop.setAttribute('stop-color', color)
            gradient.appendChild(stop)
        })

        defs.appendChild(gradient)
        svg.appendChild(defs)

        const gradGroup = document.createElementNS(svg.namespaceURI, 'g')
        gradGroup.setAttribute('mask', 'url(#logo-mask)')

        const gradRect = document.createElementNS(svg.namespaceURI, 'rect') as SVGRectElement
        gradRect.setAttribute('id', LOADING_SCREEN_GRADIENT_MOVER_ID)
        gradRect.setAttribute('x', '0')
        gradRect.setAttribute('y', '0')
        gradRect.setAttribute('width', String(vbWidth * gradientWidthMultiplier))
        gradRect.setAttribute('height', String(vbHeight))
        gradRect.setAttribute('fill', 'url(#shineGradient)')
        gradRect.style.transform = 'translateX(0)'
        gradGroup.appendChild(gradRect)
        svg.appendChild(gradGroup)

        const fillGroup = document.createElementNS(svg.namespaceURI, 'g')
        fillGroup.setAttribute('mask', 'url(#logo-mask)')

        const fillRect = document.createElementNS(svg.namespaceURI, 'rect')
        fillRect.setAttribute('id', LOADING_SCREEN_FILL_RECT_ID)
        fillRect.setAttribute('class', 'fill-rect')
        fillRect.setAttribute('x', '0')
        fillRect.setAttribute('y', '0')
        fillRect.setAttribute('width', '100%')
        fillRect.setAttribute('height', String(vbHeight))
        fillRect.setAttribute('fill', preset.fillColor)
        fillGroup.appendChild(fillRect)
        svg.appendChild(fillGroup)

        const strokeWidth = String(Math.round((3 * vbWidth) / 633))
        preset.paths.forEach((item) => {
            if (typeof item === 'object' && item.maskFill === 'black') return
            const outline = document.createElementNS(svg.namespaceURI, 'path')
            outline.setAttribute('d', typeof item === 'string' ? item : item.d)
            outline.setAttribute('stroke', preset.strokeColor)
            outline.setAttribute('stroke-width', strokeWidth)
            if (typeof item === 'object' && item.fillRule) {
                outline.setAttribute('fill-rule', item.fillRule)
            }
            svg.appendChild(outline)
        })

        return svg as SVGSVGElement
    }

    #attachHints(overlay: HTMLDivElement): void {
        const hint = document.createElement('div')
        hint.id = LOADING_SCREEN_HINT_ID
        hint.style.opacity = '0'

        let hintIndex = Math.floor(Math.random() * LOADING_SCREEN_HINTS.length)
        hint.textContent = LOADING_SCREEN_HINTS[hintIndex]
        overlay.appendChild(hint)

        const randomDelay = (): number => (2 + Math.random()) * 1000

        let hintTimeout: ReturnType<typeof setTimeout> | null = null
        const scheduleNextHint = (): void => {
            hintTimeout = setTimeout(() => {
                hint.style.opacity = '0'
                setTimeout(() => {
                    hintIndex = (hintIndex + 1) % LOADING_SCREEN_HINTS.length
                    hint.textContent = LOADING_SCREEN_HINTS[hintIndex]
                    hint.style.opacity = '1'
                    scheduleNextHint()
                }, 400)
            }, randomDelay())
        }

        hintTimeout = setTimeout(() => {
            hint.style.opacity = '1'
            scheduleNextHint()
        }, randomDelay())

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === overlay) {
                        if (hintTimeout) clearTimeout(hintTimeout)
                        observer.disconnect()
                    }
                })
            })
        })
        observer.observe(document.body, { childList: true })
    }
}

export default LoadingScreen
