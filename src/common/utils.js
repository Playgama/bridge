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

import { BANNER_CONTAINER_ID, BANNER_POSITION } from '../constants'

export const addJavaScript = function addJavaScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.addEventListener('load', resolve)
        document.head.appendChild(script)
    })
}

export const addAdsByGoogle = ({
    hostId, adsenseId, channelId, adFrequencyHint = '180s',
}) => new Promise((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('data-ad-client', adsenseId)

    if (channelId) {
        script.setAttribute('data-ad-channel', channelId)
    } else if (hostId) {
        script.setAttribute('data-ad-host', hostId)
    }

    script.setAttribute('data-ad-frequency-hint', adFrequencyHint)
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

    script.addEventListener('load', resolve)
    document.head.appendChild(script)
})

export function createAdvertisementBannerContainer(position) {
    const container = document.createElement('div')
    container.id = BANNER_CONTAINER_ID
    container.style.position = 'absolute'
    document.body.appendChild(container)

    switch (position) {
        case BANNER_POSITION.TOP:
            container.style.top = '0px'
            container.style.height = '90px'
            container.style.width = '100%'
            break
        case BANNER_POSITION.BOTTOM:
        default:
            container.style.bottom = '0px'
            container.style.height = '90px'
            container.style.width = '100%'
            break
    }

    return container
}

export function showInfoPopup(message) {
    if (!document.getElementById('bridge-info-popup-styles')) {
        const style = document.createElement('style')
        style.id = 'bridge-info-popup-styles'
        style.textContent = `
            #bridge-info-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 9998;
                display: none;
            }

            #bridge-info-popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: #2E3C75;
                color: #fff;
                padding: 20px;
                z-index: 9999;
                display: none;
                border-radius: 10px;
                box-shadow: 0 0 10px #2E3C75;
                font-size: 24px;
                font-family: 'Roboto', sans-serif;
                text-align: center;
                min-width: 250px;
                max-width: 30%;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }

            #bridge-info-popup-button {
                margin-top: 24px;
                width: 150px;
                background-color: rgba(255, 255, 255, 0.2);
                color: #fff;
                border: none;
                font-size: 24px;
                padding: 20px;
                border-radius: 5px;
                cursor: pointer;
                font-family: 'Roboto', sans-serif;
                display: block;
            }

            #bridge-info-popup-button:hover {
                background-color: rgba(255, 255, 255, 0.3);
            }`

        document.head.appendChild(style)
    }

    let overlay = document.getElementById('bridge-info-popup-overlay')
    if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'bridge-info-popup-overlay'
        document.body.appendChild(overlay)
    }

    let bridgeInfoPopup = document.getElementById('bridge-info-popup')
    if (!bridgeInfoPopup) {
        bridgeInfoPopup = document.createElement('div')
        bridgeInfoPopup.id = 'bridge-info-popup'
    }

    bridgeInfoPopup.innerText = message

    let bridgeInfoPopupButton = document.getElementById('bridge-info-popup-button')
    if (!bridgeInfoPopupButton) {
        bridgeInfoPopupButton = document.createElement('button')
        bridgeInfoPopupButton.id = 'bridge-info-popup-button'
        bridgeInfoPopupButton.innerText = 'OK'
        bridgeInfoPopup.appendChild(bridgeInfoPopupButton)
    }

    document.body.appendChild(bridgeInfoPopup)

    return new Promise((resolve) => {
        bridgeInfoPopupButton.onclick = () => {
            bridgeInfoPopup.style.display = 'none'
            overlay.style.display = 'none'
            resolve()
        }

        overlay.style.display = 'block'
        bridgeInfoPopup.style.display = 'flex'
    })
}

export function createProgressLogo() {
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

export const waitFor = function waitFor(...args) {
    if (args.length <= 0) {
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            let parent = window

            for (let i = 0; i < args.length; i++) {
                const currentObject = parent[args[i]]
                if (!currentObject) {
                    return
                }

                parent = currentObject
            }

            resolve()
            clearInterval(checkInterval)
        }, 100)
    })
}

export const isBase64Image = function isBase64Image(str) {
    const base64ImageRegex = /^data:image\/(png|jpeg|jpg|gif|bmp|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/
    return base64ImageRegex.test(str)
}

export const getKeyOrNull = (obj, key) => (obj[key] === undefined ? null : obj[key])

export function getKeysFromObject(keys, data, tryParseJson = false) {
    if (Array.isArray(keys)) {
        return keys.reduce((res, key, i) => {
            res[i] = getKeyOrNull(data, key)
            if (tryParseJson) {
                try {
                    res[i] = JSON.parse(res[i])
                } catch (e) {
                    console.error(e)
                }
            }
            return res
        }, new Array(keys.length))
    }

    return getKeyOrNull(data, keys)
}

export function deepMerge(firstObject, secondObject) {
    const result = { ...firstObject }
    const keys = Object.keys(secondObject)

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        if (
            key in firstObject
            && secondObject[key] instanceof Object
            && firstObject[key] instanceof Object
        ) {
            result[key] = deepMerge(firstObject[key], secondObject[key])
        } else {
            result[key] = secondObject[key]
        }
    }

    return result
}
