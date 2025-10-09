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

export const addJavaScript = function addJavaScript(src, options = {}) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src

        for (let i = 0; i < Object.keys(options).length; i++) {
            const key = Object.keys(options)[i]
            const value = options[key]
            script.setAttribute(key, value)
        }

        script.addEventListener('load', resolve)
        script.addEventListener('error', () => reject(new Error(`Failed to load: ${src}`)))
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

export function createLoadingOverlay() {
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

export function createAdContainer(containerId) {
    const container = document.createElement('div')
    container.id = containerId
    container.style.position = 'fixed'
    container.style.inset = '0'
    container.style.zIndex = '9999999'
    document.body.appendChild(container)

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

export function createProgressLogo(showFullLoadingLogo) {
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

    const defaultPreset = {
        viewBox: '0 0 633 819',
        paths: [
            'M632 1V632H1V1H632ZM350 125.586V507.414L380.586 538H546V451H478.599L478.308 451.278L454.598 474H443.406L450.944 452.328L451 452.169V187.459L457.369 182H546V95H380.586L350 125.586ZM283 125.586L252.414 95H87V182H175.631L182 187.459V445.54L175.631 451H87V538H252.414L283 507.414V125.586Z',
            'M633 687V660H548V687H560V791H548V819H633V792H601L592 801H587L590 792V752H627V725H590V687H633Z',
            'M533 718V675L518 660H450L435 675V802L450 819H518L533 804V734H482V761H503V788L499 792H476L467 801H462L465 792V691L469 687H499L503 691V718H533Z',
            'M402 660H310V687H322V792H310V819H402L417 804V675L402 660ZM387 788L383 792H363L354 801H349L352 792V687H383L387 691V788Z',
            'M295 687V660H239V687H251V792H239V819H295V792H283V687H295Z',
            'M215 791L200 760H209L224 745V675L209 660H121V687H132V792H121V819H162V760H166L193 819H227V791H215ZM194 729L190 733H173L164 742H159L162 733V687H190L194 691V729Z',
            'M106 724V675L91 660H0V687H12V792H0V819H91L106 804V749L89 744V728L106 724ZM73 788L69 792H53L44 801H39L42 792V752H73V788ZM73 725H53L44 734H39L42 725V687H69L73 691V725Z',
        ],
        fillColor: '#aa76ff',
        strokeColor: '#aa76ff',
        gradientStops: [
            { offset: '0.235577', color: '#aa76ff' },
            { offset: '0.240685', color: 'white' },
            { offset: '0.659749', color: '#aa76ff' },
        ],
    }

    const fullBridgePreset = {
        viewBox: '0 0 633 918',
        paths: [
            'M633 687V660H548V687H560V791H548V819H633V792H601L592 801H587L590 792V752H627V725H590V687H633Z',
            'M533 718V675L518 660H450L435 675V802L450 819H518L533 804V734H482V761H503V788L499 792H476L467 801H462L465 792V691L469 687H499L503 691V718H533Z',
            'M612 847H564V894H579V861H591V894H606V861H612C615 861 617 864 617 867V894H633V868C633 856 623 847 612 847Z',
            'M533 846C519 846 508 857 508 870C508 884 519 895 533 895C546 895 557 884 557 870C557 857 546 846 533 846ZM533 880C528 880 524 875 524 870C524 865 528 861 533 861C538 861 542 865 542 870C542 875 538 880 533 880Z',
            'M402 660H310V687H322V792H310V819H402L417 804V675L402 660ZM387 788L383 792H363L354 801H349L352 792V687H383L387 691V788Z',
            'M484 861H502V847H482C469 847 459 858 459 871C459 884 469 894 482 894H502V880H484C478 880 474 876 474 871C474 865 478 861 484 861Z',
            'M444 875C438 875 434 879 434 885C434 890 438 895 444 895C449 895 454 890 454 885C454 879 449 875 444 875Z',
            'M402 847C389 847 378 857 378 870C378 883 389 894 402 894H425V847H402ZM410 880H403C398 880 394 876 394 870C394 865 398 861 403 861H410V880Z',
            'M295 687V660H239V687H251V792H239V819H295V792H283V687H295Z',
            'M350 847H303V894H318V861H329V894H345V861H350C353 861 356 864 356 867V894H371V868C371 856 362 847 350 847Z',
            'M215 791L200 760H209L224 745V675L209 660H121V687H132V792H121V819H162V760H166L193 819H227V791H215ZM194 729L190 733H173L164 742H159L162 733V687H190L194 691V729Z',
            'M269 847C256 847 247 857 247 870C247 883 256 894 269 894H293V847H269ZM277 880H271C265 880 261 876 261 870C261 865 265 861 271 861H277V880Z',
            'M214 847C201 847 190 857 190 870C190 883 201 894 214 894H224V895C224 900 220 903 215 903H195V918H216C229 918 239 908 239 895V847H214ZM224 880H215C210 880 206 876 206 870C206 865 210 861 215 861H224V880Z',
            'M106 724V675L91 660H0V687H12V792H0V819H91L106 804V749L89 744V728L106 724ZM73 788L69 792H53L44 801H39L42 792V752H73V788ZM73 725H53L44 734H39L42 725V687H69L73 691V725Z',
            'M167 847V880H153V847H137V894H167V895C167 900 163 904 157 904H137V918H158C172 918 182 909 182 896V847H167Z',
            'M104 847C91 847 80 857 80 870C80 883 91 894 104 894H127V847H104ZM112 880H105C100 880 96 876 96 870C96 865 100 861 105 861H112V880Z',
            'M56 833V894H72V833H56Z',
            'M25 847H2V908H17V894H25C38 894 49 883 49 870C49 857 38 847 25 847ZM24 880H17V861H24C29 861 33 865 33 870C33 876 29 880 24 880Z',
            'M0 0V633H633V0H0ZM451 452L443 475H456L480 452H546V537H382L352 507V126L382 96H546V181H458L451 187V452ZM252 96L282 126V507L252 537H88V452H176L183 446V187L176 181H88V96H252Z',
        ],
        fillColor: '#aa76ff',
        strokeColor: '#aa76ff',
        gradientStops: [
            { offset: '0.235577', color: '#aa76ff' },
            { offset: '0.240685', color: 'white' },
            { offset: '0.659749', color: '#aa76ff' },
        ],
    }

    const resolved = showFullLoadingLogo === false ? defaultPreset : fullBridgePreset
    resolved.gradientWidthMultiplier = 4

    const [, , vbWidthStr, vbHeightStr] = resolved.viewBox.split(/[ ,]+/)
    const vbWidth = Number(vbWidthStr)
    const vbHeight = Number(vbHeightStr)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('id', 'logo')
    svg.setAttribute('viewBox', resolved.viewBox)
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

    resolved.paths.forEach((d) => {
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

    resolved.gradientStops.forEach(({ offset, color }) => {
        const stop = document.createElementNS(svg.namespaceURI, 'stop')
        stop.setAttribute('offset', offset)
        stop.setAttribute('stop-color', color)
        gradient.appendChild(stop)
    })

    defs.appendChild(gradient)
    svg.appendChild(defs)

    const gradGroup = document.createElementNS(svg.namespaceURI, 'g')
    gradGroup.setAttribute('mask', 'url(#logo-mask)')

    const gradRect = document.createElementNS(svg.namespaceURI, 'rect')
    gradRect.setAttribute('id', 'gradientMover')
    gradRect.setAttribute('x', '0')
    gradRect.setAttribute('y', '0')
    gradRect.setAttribute('width', String(vbWidth * resolved.gradientWidthMultiplier))
    gradRect.setAttribute('height', String(vbHeight))
    gradRect.setAttribute('fill', 'url(#shineGradient)')
    gradRect.style.transform = 'translateX(0)'
    gradGroup.appendChild(gradRect)
    svg.appendChild(gradGroup)

    const fillGroup = document.createElementNS(svg.namespaceURI, 'g')
    fillGroup.setAttribute('mask', 'url(#logo-mask)')

    const fillRect = document.createElementNS(svg.namespaceURI, 'rect')
    fillRect.setAttribute('id', 'fillRect')
    fillRect.setAttribute('class', 'fill-rect')
    fillRect.setAttribute('x', '0')
    fillRect.setAttribute('y', '0')
    fillRect.setAttribute('width', '100%')
    fillRect.setAttribute('height', String(vbHeight))
    fillRect.setAttribute('fill', resolved.fillColor)
    fillGroup.appendChild(fillRect)
    svg.appendChild(fillGroup)

    resolved.paths.forEach((d) => {
        const outline = document.createElementNS(svg.namespaceURI, 'path')
        outline.setAttribute('d', d)
        outline.setAttribute('stroke', resolved.strokeColor)
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
                    // keep value as is
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

export function deformatPrice(priceStr) {
    const cleaned = priceStr.replace(/[^\d.,-]/g, '')

    if (cleaned.includes('.') && cleaned.includes(',') && cleaned.indexOf(',') < cleaned.indexOf('.')) {
        return parseFloat(cleaned.replace(/,/g, ''))
    }

    if (cleaned.includes('.') && cleaned.includes(',') && cleaned.indexOf(',') > cleaned.indexOf('.')) {
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
    }

    if (cleaned.includes(',')
        && cleaned.lastIndexOf(',') !== -1
        && cleaned.lastIndexOf(',') === cleaned.length - 4) {
        return parseInt(cleaned.replace(/,/, ''), 10)
    }

    if (cleaned.includes(',')
        && cleaned.lastIndexOf(',') !== -1
        && cleaned.lastIndexOf(',') !== cleaned.length - 3) {
        return parseFloat(cleaned.replace(',', '.'))
    }

    if (cleaned.includes('.')
        && cleaned.lastIndexOf('.') !== -1
        && cleaned.lastIndexOf('.') === cleaned.length - 4) {
        return parseInt(cleaned.replace(/\./, ''), 10)
    }

    if (cleaned.includes('.')) {
        return parseFloat(cleaned)
    }

    return parseInt(cleaned, 10)
}

export function getGuestUser() {
    const localStorageKey = 'bridge_player_guest_id'
    let id

    try {
        id = localStorage.getItem(localStorageKey)
    } catch (_) {
        // ignore
    }

    if (!id) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        const randomPart = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
        const timestampPart = Date.now().toString(36)
        id = `${randomPart}${timestampPart}`

        try {
            localStorage.setItem(localStorageKey, id)
        } catch (_) {
            // ignore
        }
    }

    return {
        id,
        name: `Guest ${id}`,
    }
}
