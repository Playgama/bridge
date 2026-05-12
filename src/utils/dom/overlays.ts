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

import { ORIENTATION_OVERLAY_ID } from '../../modules/device/constants'

export function createLoadingOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    overlay.style.display = 'flex'
    overlay.style.justifyContent = 'center'
    overlay.style.alignItems = 'center'
    overlay.style.zIndex = '9999'
    overlay.id = 'loading-overlay'

    const loading = document.createElement('div')
    loading.style.fontSize = '24px'
    loading.style.color = '#fff'
    loading.innerText = 'Loading...'
    overlay.appendChild(loading)

    return overlay
}

export function createOrientationOverlay(): HTMLDivElement {
    if (!document.getElementById('bridge-orientation-overlay-styles')) {
        const style = document.createElement('style')
        style.id = 'bridge-orientation-overlay-styles'
        style.textContent = `
            #${ORIENTATION_OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.95);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999999;
            }

            #bridge-orientation-icon {
                width: 80px;
                height: 80px;
                animation: bridge-rotate-phone 1.5s ease-in-out infinite;
            }

            #bridge-orientation-message {
                color: #fff;
                font-size: 18px;
                font-family: Arial, sans-serif;
                margin-top: 20px;
                text-align: center;
            }

            @keyframes bridge-rotate-phone {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(90deg); }
            }
        `
        document.head.appendChild(style)
    }

    const overlay = document.createElement('div')
    overlay.id = ORIENTATION_OVERLAY_ID

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('id', 'bridge-orientation-icon')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('fill', 'none')
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    icon.innerHTML = `
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="white" stroke-width="2"/>
        <line x1="12" y1="18" x2="12" y2="18" stroke="white" stroke-width="2" stroke-linecap="round"/>
    `

    const message = document.createElement('div')
    message.id = 'bridge-orientation-message'
    message.innerText = 'Please rotate your device'

    overlay.appendChild(icon)
    overlay.appendChild(message)

    return overlay
}
