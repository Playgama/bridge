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
import ModuleBase from './ModuleBase'
import { EVENT_NAME } from '../constants'

class GameModule extends ModuleBase {
    get visibilityState() {
        return this._platformBridge.visibilityState
    }

    constructor(platformBridge, disableLoadingLogo = false) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.VISIBILITY_STATE_CHANGED,
            (state) => this.emit(EVENT_NAME.VISIBILITY_STATE_CHANGED, state),
        )

        this._disableLoadingLogo = disableLoadingLogo

        if (!disableLoadingLogo) {
            this.#createProgressLogo()
        }
    }

    _setLoadingProgressCalled = false

    _loadingProcessCompleted = false

    _disableLoadingLogo = false

    #createProgressLogo() {
        const style = document.createElement('style')
        style.textContent = `
            .fullscreen {
                background: #242424;
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0px;
                left: 0px;
            }

            #loading-overlay {
                font-size: 20px;
                z-index: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }

            #logo {
                width: 10%;
                max-width: 300px;
                min-width: 120px;
                overflow: visible;
            }

            .fill-rect {
                transform: translateY(100%);
                transition: transform 0.3s ease-out;
            }

            #gradientMover {
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

        const overlay = document.createElement('div')
        overlay.id = 'loading-overlay'
        overlay.className = 'fullscreen'
        document.body.appendChild(overlay)

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('id', 'logo')
        svg.setAttribute('viewBox', '0 0 633 819')
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

        const whitePaths = [
            'M632 1V632H1V1H632ZM350 125.586V507.414L380.586 538H546V451H478.599L478.308 451.278L454.598 474H443.406L450.944 452.328L451 452.169V187.459L457.369 182H546V95H380.586L350 125.586ZM283 125.586L252.414 95H87V182H175.631L182 187.459V445.54L175.631 451H87V538H252.414L283 507.414V125.586Z',
            'M633 687V660H548V687H560V791H548V819H633V792H601L592 801H587L590 792V752H627V725H590V687H633Z',
            'M533 718V675L518 660H450L435 675V802L450 819H518L533 804V734H482V761H503V788L499 792H476L467 801H462L465 792V691L469 687H499L503 691V718H533Z',
            'M402 660H310V687H322V792H310V819H402L417 804V675L402 660ZM387 788L383 792H363L354 801H349L352 792V687H383L387 691V788Z',
            'M295 687V660H239V687H251V792H239V819H295V792H283V687H295Z',
            'M215 791L200 760H209L224 745V675L209 660H121V687H132V792H121V819H162V760H166L193 819H227V791H215ZM194 729L190 733H173L164 742H159L162 733V687H190L194 691V729Z',
            'M106 724V675L91 660H0V687H12V792H0V819H91L106 804V749L89 744V728L106 724ZM73 788L69 792H53L44 801H39L42 792V752H73V788ZM73 725H53L44 734H39L42 725V687H69L73 691V725Z',
        ]

        whitePaths.forEach((d) => {
            const path = document.createElementNS(svg.namespaceURI, 'path')
            path.setAttribute('d', d)
            path.setAttribute('fill', 'white')
            mask.appendChild(path)
        })

        defs.appendChild(mask)

        const gradient = document.createElementNS(svg.namespaceURI, 'linearGradient')
        gradient.setAttribute('id', 'shineGradient')
        gradient.setAttribute('x1', '1233')
        gradient.setAttribute('y1', '0')
        gradient.setAttribute('x2', '1866')
        gradient.setAttribute('y2', '633')
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse')

        const stops = [
            { offset: '0.235577', color: '#aa76ff' },
            { offset: '0.240685', color: 'white' },
            { offset: '0.659749', color: '#aa76ff' },
        ]

        stops.forEach(({ offset, color }) => {
            const stop = document.createElementNS(svg.namespaceURI, 'stop')
            stop.setAttribute('offset', offset)
            stop.setAttribute('stop-color', color)
            gradient.appendChild(stop)
        })

        defs.appendChild(gradient)
        svg.appendChild(defs)

        // gradient rect group
        const gradGroup = document.createElementNS(svg.namespaceURI, 'g')
        gradGroup.setAttribute('mask', 'url(#logo-mask)')

        const gradRect = document.createElementNS(svg.namespaceURI, 'rect')
        gradRect.setAttribute('id', 'gradientMover')
        gradRect.setAttribute('x', '0')
        gradRect.setAttribute('y', '0')
        gradRect.setAttribute('width', '2532')
        gradRect.setAttribute('height', '819')
        gradRect.setAttribute('fill', 'url(#shineGradient)')
        gradRect.style.transform = 'translateX(0)'
        gradGroup.appendChild(gradRect)
        svg.appendChild(gradGroup)

        // fill rect group
        const fillGroup = document.createElementNS(svg.namespaceURI, 'g')
        fillGroup.setAttribute('mask', 'url(#logo-mask)')

        const fillRect = document.createElementNS(svg.namespaceURI, 'rect')
        fillRect.setAttribute('id', 'fillRect')
        fillRect.setAttribute('class', 'fill-rect')
        fillRect.setAttribute('x', '0')
        fillRect.setAttribute('y', '0')
        fillRect.setAttribute('width', '100%')
        fillRect.setAttribute('height', '819')
        fillRect.setAttribute('fill', '#aa76ff')
        fillGroup.appendChild(fillRect)
        svg.appendChild(fillGroup)

        // stroked paths
        whitePaths.forEach((d) => {
            const outline = document.createElementNS(svg.namespaceURI, 'path')
            outline.setAttribute('d', d)
            outline.setAttribute('stroke', '#aa76ff')
            outline.setAttribute('stroke-width', '3')
            svg.appendChild(outline)
        })

        overlay.appendChild(svg)
    }

    setLoadingProgress(percent) {
        if (this._loadingProcessCompleted) {
            console.warn('Loading process already completed. Ignoring further calls to setLoadingProgress.')
            return
        }

        this._setLoadingProgressCalled = true
        const fill = document.getElementById('fillRect')
        const gradientMover = document.getElementById('gradientMover')
        const logo = document.getElementById('logo')
        const loadingOverlay = document.getElementById('loading-overlay')

        const _percent = Math.max(0, Math.min(100, percent))
        const translateY = 100 - _percent
        fill.style.transform = `translateY(${translateY}%)`

        if (_percent === 100) {
            this._loadingProcessCompleted = true

            setTimeout(() => {
                gradientMover.style.display = 'block'
                gradientMover.classList.add('gradient-mover')
            }, 400)
            setTimeout(() => logo.classList.add('logo-fade-out'), 900)
            setTimeout(() => loadingOverlay.remove(), 1400)
        } else {
            gradientMover.classList.remove('gradient-mover')
        }
    }

    completeLoadingProgress() {
        if (!this._disableLoadingLogo) {
            setTimeout(() => {
                if (!this._setLoadingProgressCalled) {
                    this.setLoadingProgress(100)
                }
            }, 700)
        }
    }
}

EventLite.mixin(GameModule.prototype)
export default GameModule
