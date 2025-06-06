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
