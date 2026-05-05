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
    ADVANCED_BANNER_CONTAINER_ID_PREFIX, BANNER_CONTAINER_ID, BANNER_POSITION, DEVICE_ORIENTATION,
    ORIENTATION_OVERLAY_ID,
} from '../constants'

const POST_METHOD = ['post', 'Message'].join('')

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
    adSenseId,
    channelId,
    hostId,
    interstitialPlacementId,
    rewardedPlacementId,
    adFrequencyHint = '180s',
    testMode = false,
}, config = {}) => new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

    script.setAttribute('data-ad-client', adSenseId)

    if (channelId) {
        script.setAttribute('data-ad-channel', channelId)
    } else if (hostId) {
        script.setAttribute('data-ad-host', hostId)
    }

    if (interstitialPlacementId) {
        script.setAttribute('data-admob-interstitial-slot', interstitialPlacementId)
    }

    if (rewardedPlacementId) {
        script.setAttribute('data-admob-rewarded-slot', rewardedPlacementId)
    }

    if (testMode) {
        script.setAttribute('data-adbreak-test', 'on')
    }

    script.setAttribute('data-ad-frequency-hint', adFrequencyHint)
    script.setAttribute('crossorigin', 'anonymous')

    script.addEventListener('load', () => {
        window.adsbygoogle = window.adsbygoogle || []
        window.adsbygoogle.push({
            preloadAdBreaks: 'on',
            sound: 'on',
            onReady: () => {},
            ...config,
        })

        resolve((adOptions) => window.adsbygoogle.push(adOptions))
    })

    script.addEventListener('error', () => {
        reject(new Error('adsbygoogle script failed to load'))
    })
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

export function createAdvancedBannerContainers(banners) {
    const containerIds = []

    banners.forEach((banner, index) => {
        const container = document.createElement('div')
        const id = `${ADVANCED_BANNER_CONTAINER_ID_PREFIX}${index}`
        container.id = id
        container.style.position = 'absolute'
        container.style.zIndex = '9999'

        if (banner.width) container.style.width = banner.width
        if (banner.height) container.style.height = banner.height
        if (banner.top) container.style.top = banner.top
        if (banner.bottom) container.style.bottom = banner.bottom
        if (banner.left) container.style.left = banner.left
        if (banner.right) container.style.right = banner.right

        document.body.appendChild(container)
        containerIds.push(id)
    })

    return containerIds
}

export function removeAdvancedBannerContainers() {
    const containers = document.querySelectorAll(`[id^="${ADVANCED_BANNER_CONTAINER_ID_PREFIX}"]`)
    containers.forEach((container) => container.remove())
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

export function createOrientationOverlay() {
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

export function showInfoPopup(message) {
    if (!document.getElementById('bridge-info-popup-styles')) {
        const style = document.createElement('style')
        style.id = 'bridge-info-popup-styles'
        style.textContent = `
            #bridge-info-popup-overlay {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0, 0, 0, 0.24);
                z-index: 9999;
            }

            #bridge-info-popup {
                width: min(92vw, 320px);
                padding: 24px 20px 20px;
                border-radius: 26px;
                background: #ffffff;
                color: #24304d;
                text-align: center;
                box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
                font-family: Inter, Arial, sans-serif;
            }

            #bridge-info-popup-emoji {
                font-size: 42px;
                margin-bottom: 10px;
                line-height: 1;
            }

            #bridge-info-popup-title {
                margin: 0 0 10px;
                font-size: 24px;
                line-height: 1.1;
            }

            #bridge-info-popup-message {
                margin: 0 0 18px;
                font-size: 15px;
                line-height: 1.45;
                color: #66708b;
            }

            #bridge-info-popup-button {
                min-width: 140px;
                height: 46px;
                padding: 0 24px;
                border: 0;
                border-radius: 999px;
                font-weight: 700;
                font-size: 15px;
                color: #ffffff;
                background: linear-gradient(180deg, #5f8cff, #4c71e6);
                box-shadow: 0 8px 20px rgba(76, 113, 230, 0.32);
                cursor: pointer;
                font-family: Inter, Arial, sans-serif;
            }

            #bridge-info-popup-button:active {
                transform: translateY(1px);
            }`

        document.head.appendChild(style)
    }

    let overlay = document.getElementById('bridge-info-popup-overlay')
    if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'bridge-info-popup-overlay'
        document.body.appendChild(overlay)
    }

    let popup = document.getElementById('bridge-info-popup')
    if (!popup) {
        popup = document.createElement('div')
        popup.id = 'bridge-info-popup'
        overlay.appendChild(popup)
    }

    popup.innerHTML = ''

    const emoji = document.createElement('div')
    emoji.id = 'bridge-info-popup-emoji'
    emoji.textContent = '\uD83C\uDFAC'
    popup.appendChild(emoji)

    const title = document.createElement('h3')
    title.id = 'bridge-info-popup-title'
    title.textContent = message
    popup.appendChild(title)

    const button = document.createElement('button')
    button.id = 'bridge-info-popup-button'
    button.textContent = 'Continue'
    popup.appendChild(button)

    return new Promise((resolve) => {
        button.onclick = () => {
            overlay.style.display = 'none'
            resolve()
        }

        overlay.style.display = 'flex'
    })
}

export function showAdFailurePopup() {
    if (!document.getElementById('bridge-ad-failure-popup-fonts')) {
        const preconnect1 = document.createElement('link')
        preconnect1.rel = 'preconnect'
        preconnect1.href = 'https://fonts.googleapis.com'
        document.head.appendChild(preconnect1)

        const preconnect2 = document.createElement('link')
        preconnect2.rel = 'preconnect'
        preconnect2.href = 'https://fonts.gstatic.com'
        preconnect2.crossOrigin = 'anonymous'
        document.head.appendChild(preconnect2)

        const fontLink = document.createElement('link')
        fontLink.id = 'bridge-ad-failure-popup-fonts'
        fontLink.rel = 'stylesheet'
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Cal+Sans&display=swap'
        document.head.appendChild(fontLink)
    }

    if (!document.getElementById('bridge-ad-failure-popup-styles')) {
        const style = document.createElement('style')
        style.id = 'bridge-ad-failure-popup-styles'
        style.textContent = `
            #bridge-ad-failure-popup {
                position: fixed;
                top: 0;
                left: 0;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                padding: 24px 16px;
                background: #682eb2;
                display: none;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 32px 1fr;
                z-index: 9999999;
                font-family: 'Cal Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                color: #fff;
                cursor: pointer;
            }

            #bridge-ad-failure-popup-logo {
                height: 32px;
            }

            #bridge-ad-failure-popup-close {
                all: unset;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: #fff;
                border-radius: 50%;
                justify-self: end;
            }

            #bridge-ad-failure-popup-text {
                grid-column: span 2;
                font-size: 21px;
                font-style: normal;
                font-weight: 400;
                line-height: 110%;
                align-self: end;
                margin: 0;
            }

            @media (min-width: 320px) {
                #bridge-ad-failure-popup {
                    padding: 24px;
                    grid-template-rows: 40px 1fr;
                }

                #bridge-ad-failure-popup-logo {
                    height: 40px;
                }

                #bridge-ad-failure-popup-close {
                    width: 40px;
                    height: 40px;
                }

                #bridge-ad-failure-popup-text {
                    font-size: 25px;
                    align-self: center;
                }
            }

            @media (orientation: landscape) {
                #bridge-ad-failure-popup {
                    gap: 40px;
                }

                #bridge-ad-failure-popup-text {
                    width: 60%;
                    align-self: start;
                }
            }

            @media (orientation: landscape) and (min-width: 800px) {
                #bridge-ad-failure-popup {
                    gap: 80px;
                }

                #bridge-ad-failure-popup-text {
                    width: 50%;
                    font-size: 33px;
                }
            }
        `
        document.head.appendChild(style)
    }

    let popup = document.getElementById('bridge-ad-failure-popup')
    if (!popup) {
        popup = document.createElement('div')
        popup.id = 'bridge-ad-failure-popup'

        const logo = document.createElement('div')
        logo.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 120 32" id="bridge-ad-failure-popup-logo">
                <rect width="120" height="32" fill="#fff" rx="16"/>
                <path fill="#682EB2" d="M12.378 23.772V9.844h5.356c2.957 0 5.356 2.39 5.356 5.339 0 2.948-2.398 5.34-5.356 5.34h-1.863v3.25zm5.007-10.678H15.87v4.178h1.514c1.257 0 2.096-.928 2.096-2.089 0-1.16-.839-2.09-2.096-2.09M28.267 20.522h-3.632V6.594h3.632zM40.518 20.522h-5.356c-2.958 0-5.357-2.39-5.357-5.339 0-2.948 2.4-5.34 5.357-5.34h5.356zm-5.007-3.25h1.514v-4.178H35.51c-1.258 0-2.096.928-2.096 2.089 0 1.16.838 2.09 2.096 2.09M47.465 26.094H42.62v-3.25h4.611c1.234 0 2.142-.906 2.142-2.136v-.186h-6.753V9.844h3.493v7.428h3.26V9.844h3.493V20.94c0 2.972-2.282 5.154-5.402 5.154M59.813 9.844h5.821V20.73c0 3.111-2.258 5.363-5.379 5.363h-4.634v-3.482h4.61c1.095 0 1.91-.813 1.91-1.904v-.186h-2.328c-2.958 0-5.357-2.39-5.357-5.339 0-2.948 2.399-5.34 5.356-5.34m-1.747 5.339c0 1.16.838 2.09 2.096 2.09h1.98v-4.18h-1.98c-1.258 0-2.096.93-2.096 2.09M77.834 20.522h-5.357c-2.957 0-5.356-2.39-5.356-5.339 0-2.948 2.399-5.34 5.356-5.34h5.356zm-5.007-3.25h1.513v-4.178h-1.513c-1.258 0-2.096.928-2.096 2.089 0 1.16.838 2.09 2.096 2.09M83.43 20.522h-3.493V9.844h10.829c2.631 0 4.773 2.136 4.773 4.759v5.92h-3.493V14.37a1.29 1.29 0 0 0-1.28-1.277h-1.281v7.428h-3.493v-7.428H83.43zM107.623 20.522h-5.356c-2.958 0-5.356-2.39-5.356-5.339 0-2.948 2.398-5.34 5.356-5.34h5.356zm-5.007-3.25h1.514v-4.178h-1.514c-1.257 0-2.096.928-2.096 2.089 0 1.16.839 2.09 2.096 2.09"/>
            </svg>
        `
        popup.appendChild(logo)

        const closeButton = document.createElement('button')
        closeButton.id = 'bridge-ad-failure-popup-close'
        closeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path fill="#682EB2" d="M17.886 7.886a1.252 1.252 0 0 0-1.77-1.77l-4.113 4.117L7.886 6.12a1.252 1.252 0 0 0-1.77 1.77l4.117 4.113L6.12 16.12a1.252 1.252 0 0 0 1.77 1.77l4.113-4.117 4.117 4.113a1.252 1.252 0 0 0 1.77-1.77l-4.117-4.113z"/>
            </svg>
        `
        popup.appendChild(closeButton)

        const text = document.createElement('p')
        text.id = 'bridge-ad-failure-popup-text'
        popup.appendChild(text)

        document.body.appendChild(popup)
    }

    const closeButton = document.getElementById('bridge-ad-failure-popup-close')

    return new Promise((resolve) => {
        const closePopup = () => {
            popup.style.display = 'none'
            resolve()
        }

        closeButton.onclick = closePopup
        popup.onclick = closePopup

        const messages = [
            'If you see this message, no Ad was returned for the Ad request.<br><br>Please ask the developer to check the Ad setup.',
            'This is placeholder for the Ad. Playgama helps games reach players worldwide.',
        ]
        const textElement = document.getElementById('bridge-ad-failure-popup-text')
        textElement.innerHTML = messages[Math.floor(Math.random() * messages.length)]

        popup.style.display = 'grid'
    })
}

export function createProgressLogo(showFullLoadingLogo, showLoadingText = false) {
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

        #loading-hint {
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
        viewBox: '0 0 633 986',
        paths: [
            'M224.044 880.996V933.01H247.059V880.996H269.036V954.011C269.036 972.997 256.033 986 234.056 986H202.067V967.991H231.064C242.053 967.991 247.059 960.97 247.059 952.973V949.981H202.067V880.996H224.044Z',
            { d: 'M355.051 880.996V952.912C355.051 971.959 340.094 985.939 320.071 985.939H289.059V966.953H319.033C328.007 966.953 333.013 960.97 333.013 952.973V949.981H317.019C297.972 949.981 281.001 935.024 281.001 915C281.001 896.014 298.033 880.996 317.019 880.996H355.051ZM320.01 897.968C310.975 897.968 304.992 904.927 304.992 914.939C304.992 925.928 311.036 932.949 320.01 932.949H333.013V897.968H320.01Z', fillRule: 'evenodd' },
            { d: 'M34.0643 880.996C53.05 880.996 71.0593 895.953 71.0593 915C71.0593 934.963 53.05 949.981 34.0643 949.981H22.0378V970.982H0.0608089V880.996H34.0643ZM22.0378 897.968V932.949H32.0498C41.0238 932.949 47.0672 925.989 47.0672 914.939C47.0672 904.989 41.0238 897.968 32.0498 897.968H22.0378Z', fillRule: 'evenodd' },
            'M105.062 870.007V949.981H81.0707V870.007H105.062Z',
            { d: 'M187.049 880.996V949.981H152.069C133.022 949.981 116.051 935.024 116.051 915C116.051 896.014 133.083 880.996 152.069 880.996H187.049ZM154.999 897.968C145.964 897.968 139.981 904.927 139.981 914.939C139.981 925.928 146.025 932.949 154.999 932.949H165.011V897.968H154.999Z', fillRule: 'evenodd' },
            { d: 'M436 880.996V949.981H401.02C381.973 949.981 365.002 935.024 365.002 915C365.002 896.014 382.034 880.996 401.02 880.996H436ZM404.011 897.968C394.976 897.968 388.994 904.927 388.994 914.939C388.994 925.928 395.037 932.949 404.011 932.949H414.023V897.968H404.011Z', fillRule: 'evenodd' },
            'M521.039 880.996C538.987 880.996 551.99 894 551.99 912.009V949.981H530.013V908.957C530.013 903.951 525.984 897.968 520.001 897.968H512.004V949.981H490.027V897.968H472.018V949.981H450.041V880.996H521.039Z',
            { d: 'M633 880.996V949.981H598.019C579.034 949.981 563.039 935.024 563.039 915C563.039 896.014 579.034 880.996 598.019 880.996H633ZM603.025 897.968C593.014 897.968 587.031 904.927 587.031 914.939C587.031 925.928 593.014 932.949 603.025 932.949H611.023V897.968H603.025Z', fillRule: 'evenodd' },
            'M522.993 663.967L538.01 678.986V732.037H504.068V695.041L500.038 691.012H482.029L478.001 695.041V829.044L475.009 838.018H480.015L488.989 829.044H499.978L504.007 825.015V775.015H491.004V748.032H538.01V841.009L522.993 856.027H459.015L443.997 838.994V678.986L459.015 663.967H522.993Z',
            'M633 664.029V691.073H601.011V739.057H627.017V766.041H601.011V829.044L598.019 838.018H603.025L611.999 829.044H633V856.027H553.028V828.006H567.007V691.012H553.028V664.029H633Z',
            { d: 'M89.0069 664.029L104.025 679.046V738.02L87.0533 741.927V757.922L104.025 762.928V840.948L89.0069 855.966H0V828.983H13.9801V691.012H0V664.029H89.0069ZM47.983 765.98V828.983L44.992 837.956H49.998L59.0329 828.983H65.9919L70.0214 824.953H69.96V765.98H47.983ZM47.983 691.012V738.997L44.992 747.971H49.998L59.0329 738.997H70.0214V695.041L65.9919 691.012H47.983Z', fillRule: 'evenodd' },
            { d: 'M210.003 664.029L225.02 679.046V759.02L210.003 774.039L217.023 828.006V827.945H227.951V855.966H184.973L176.976 773.977H166.964V855.966H118.981V828.983H132.961V691.012H118.981V664.029H210.003ZM167.025 691.012V746.994L164.034 755.968H169.04L178.014 746.994H186.988L191.017 742.965H191.078V695.041L187.049 691.012H167.025Z', fillRule: 'evenodd' },
            'M302.001 664.029V691.012H288.021V828.983H302.001V855.966H239.977V828.983H253.957V691.012H239.977V664.029H302.001Z',
            { d: 'M411.032 663.967L426.05 678.924V840.887L411.032 855.905H317.019V828.921H330.999V690.951H317.019V663.967H411.032ZM365.002 691.012V828.983L362.011 837.956H367.017L376.052 828.983H388.078L392.046 824.953H391.985V695.041L388.017 691.012H365.002Z', fillRule: 'evenodd' },
            { d: 'M633 0V635.946H0.0608089V0H633ZM88.0298 92.0008V177.042H176.06L183.02 183.024V446.023L176.06 452.006H88.0298V536.986H252.003L252.004 536.986H252.065L282.039 507.011V121.976L252.065 92.0008H88.0298ZM382.034 92.0008L351.999 122.037V507.011L382.034 536.986H546.007L546.008 452.006H480.015L456.024 475.021H443.021L451.018 452.006V183.024L458.038 177.042H546.008V92.0616L546.007 92.0008H382.034Z', fillRule: 'evenodd' },
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

    resolved.paths.forEach((item) => {
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

    const strokeWidth = String(Math.round((3 * vbWidth) / 633))
    resolved.paths.forEach((item) => {
        if (typeof item === 'object' && item.maskFill === 'black') return
        const outline = document.createElementNS(svg.namespaceURI, 'path')
        outline.setAttribute('d', typeof item === 'string' ? item : item.d)
        outline.setAttribute('stroke', resolved.strokeColor)
        outline.setAttribute('stroke-width', strokeWidth)
        if (typeof item === 'object' && item.fillRule) {
            outline.setAttribute('fill-rule', item.fillRule)
        }
        svg.appendChild(outline)
    })

    overlay.appendChild(svg)

    if (showLoadingText) {
        const hints = [
            'Loading GPU',
            'Parsing AST',
            'Linking libs',
            'Baking mesh',
            'Warming JIT',
            'Tracing rays',
            'Packing data',
            'Flushing GPU',
            'Loading WASM',
            'Alloc memory',
            'Init shaders',
            'Optimize FPS',
            'Sync textures',
            'Build navmesh',
            'Compile code',
            'Load physics',
            'Stream assets',
            'Cache buffers',
            'Map controls',
            'Decode audio',
            'Init network',
            'Setup scene',
        ]

        const hint = document.createElement('div')
        hint.id = 'loading-hint'
        hint.style.opacity = '0'

        let hintIndex = Math.floor(Math.random() * hints.length)
        hint.textContent = hints[hintIndex]
        overlay.appendChild(hint)

        const randomDelay = () => (2 + Math.random()) * 1000

        let hintTimeout = null
        const scheduleNextHint = () => {
            hintTimeout = setTimeout(() => {
                hint.style.opacity = '0'
                setTimeout(() => {
                    hintIndex = (hintIndex + 1) % hints.length
                    hint.textContent = hints[hintIndex]
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
                        clearTimeout(hintTimeout)
                        observer.disconnect()
                    }
                })
            })
        })
        observer.observe(document.body, { childList: true })
    }
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

    let value = getKeyOrNull(data, keys)
    if (tryParseJson && typeof value === 'string') {
        try {
            value = JSON.parse(value)
        } catch (e) {
            // keep value as is
        }
    }
    return value
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

export function generateRandomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const randomPart = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
    const timestampPart = Date.now().toString(36)
    return `${randomPart}${timestampPart}`
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
        id = generateRandomId()

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

export function postToParent(message, targetOrigin = '*') {
    if (window.parent) {
        window.parent[POST_METHOD](message, targetOrigin)
    }
}

export function postToSystem(message) {
    if (window.system) {
        window.system[POST_METHOD](message)
    }
}

export function postToWebView(message) {
    if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        window.chrome.webview[POST_METHOD](message)
    }
}

export function detectOrientation() {
    return window.innerHeight > window.innerWidth
        ? DEVICE_ORIENTATION.PORTRAIT
        : DEVICE_ORIENTATION.LANDSCAPE
}

export function getSafeArea() {
    const div = document.createElement('div')
    div.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);pointer-events:none;visibility:hidden;'
    document.body.appendChild(div)

    const rect = div.getBoundingClientRect()
    const result = {
        top: rect.top,
        bottom: window.innerHeight - rect.bottom,
        left: rect.left,
        right: window.innerWidth - rect.right,
    }

    div.remove()
    return result
}

export function applySafeAreaStyles() {
    const style = document.createElement('style')
    style.id = 'bridge-safe-area-styles'
    style.textContent = `
        html, body {
            height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            box-sizing: border-box;
        }
    `
    document.head.appendChild(style)
}

export function findGameCanvas() {
    return document.querySelector('canvas')
}
