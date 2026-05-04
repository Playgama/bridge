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

export function createYoutubeSubscribeNotification() {
    if (!document.getElementById('bridge-youtube-subscribe-styles')) {
        const style = document.createElement('style')
        style.id = 'bridge-youtube-subscribe-styles'
        style.textContent = `
            #bridge-youtube-subscribe {
                position: fixed;
                inset: 0;
                pointer-events: none;
                transform-origin: 168px calc(100% - 56px);
                z-index: 9999999;
                animation: bridge-yt-press 650ms ease-in-out 1270ms forwards;
            }

            #bridge-youtube-subscribe .bridge-yt-button {
                position: fixed;
                bottom: -24px;
                left: 24px;
                width: 220.8px;
                height: 64px;
                border-radius: 107.8px;
                padding: 11.2px 25.6px 12.8px 25.6px;
                background-color: #9747FF;
                box-shadow: inset 0 0 17.06px 0 rgba(151, 71, 255, 0.7), inset 0 0 16px 0 rgba(255, 255, 255, 0.7);
                box-sizing: border-box;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                overflow: hidden;
                white-space: nowrap;
                pointer-events: none;
                animation:
                    bridge-yt-rise-button 285ms ease-out 590ms forwards,
                    bridge-yt-button-shrink 295ms cubic-bezier(0.4, 0, 0.2, 1) 2100ms forwards;
            }

            #bridge-youtube-subscribe .bridge-yt-title {
                width: 168.8px;
                height: 28.8px;
                display: block;
                flex-shrink: 0;
            }

            #bridge-youtube-subscribe .bridge-yt-ball {
                position: fixed;
                bottom: -88px;
                left: 248px;
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background-color: #9747FF;
                box-shadow: inset 0 0 17.06px 0 rgba(151, 71, 255, 0.7), inset 0 0 16px 0 rgba(255, 255, 255, 0.7);
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation:
                    bridge-yt-rise-ball 285ms ease-out 630ms forwards,
                    bridge-yt-ball-roll 470ms cubic-bezier(0.34, 1.2, 0.5, 1) 2100ms forwards;
            }

            #bridge-youtube-subscribe .bridge-yt-ball svg {
                position: absolute;
            }

            #bridge-youtube-subscribe .bridge-yt-arrow {
                width: 25.6px;
                height: 25.6px;
                opacity: 1;
                animation: bridge-yt-arrow-fade-out 235ms ease 2220ms forwards;
            }

            #bridge-youtube-subscribe .bridge-yt-hand {
                width: 28.8px;
                height: 28.8px;
                opacity: 0;
                animation: bridge-yt-hand-fade-in 235ms ease 2335ms forwards;
            }

            @keyframes bridge-yt-rise-button {
                0%   { bottom: -24px;  opacity: 0; }
                40%  { bottom: 25.6px; opacity: 1; }
                48%  { bottom: 33.6px; }
                60%  { bottom: 32px; }
                70%  { bottom: 30.4px; }
                79%  { bottom: 28.8px; }
                88%  { bottom: 27.2px; }
                95%  { bottom: 25.6px; }
                100% { bottom: 24px;   opacity: 1; }
            }
            @keyframes bridge-yt-rise-ball {
                0%   { bottom: -88px;  opacity: 0; }
                40%  { bottom: 25.6px; opacity: 1; }
                48%  { bottom: 33.6px; }
                60%  { bottom: 32px; }
                70%  { bottom: 30.4px; }
                79%  { bottom: 28.8px; }
                88%  { bottom: 27.2px; }
                95%  { bottom: 25.6px; }
                100% { bottom: 24px;   opacity: 1; }
            }
            @keyframes bridge-yt-press {
                0%   { transform: scale(1); }
                25%  { transform: scale(0.94); }
                40%  { transform: scale(0.9); }
                65%  { transform: scale(1.01); }
                82%  { transform: scale(0.995); }
                100% { transform: scale(1); }
            }
            @keyframes bridge-yt-button-shrink {
                0%   { width: 220.8px; opacity: 1; }
                100% { width: 64px;    opacity: 0; }
            }
            @keyframes bridge-yt-ball-roll {
                0%   { left: 248px; transform: rotate(0deg); }
                100% { left: 24px;  transform: rotate(-360deg); }
            }
            @keyframes bridge-yt-arrow-fade-out {
                to { opacity: 0; }
            }
            @keyframes bridge-yt-hand-fade-in {
                to { opacity: 1; }
            }
        `
        document.head.appendChild(style)
    }

    const container = document.createElement('div')
    container.id = 'bridge-youtube-subscribe'
    container.innerHTML = `
        <div class="bridge-yt-button">
            <svg class="bridge-yt-title" viewBox="0 0 211 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.864 35.664C10.208 35.664 7.75999 35.104 5.51999 33.984C3.31199 32.832 1.47199 30.976 -1.09524e-05 28.416L5.80799 24.72C6.67199 26.448 7.75999 27.712 9.07199 28.512C10.384 29.28 11.776 29.664 13.248 29.664C14.816 29.664 16.048 29.312 16.944 28.608C17.84 27.904 18.288 26.976 18.288 25.824C18.288 24.704 17.936 23.808 17.232 23.136C16.528 22.464 15.584 21.92 14.4 21.504C13.248 21.088 11.984 20.704 10.608 20.352C8.01599 19.68 5.95199 18.576 4.41599 17.04C2.87999 15.472 2.11199 13.424 2.11199 10.896C2.11199 8.88004 2.60799 7.12004 3.59999 5.61604C4.59199 4.11204 5.96799 2.94404 7.72799 2.11204C9.51999 1.28004 11.6 0.864038 13.968 0.864038C16.592 0.864038 18.784 1.40804 20.544 2.49604C22.304 3.58404 23.808 5.12004 25.056 7.10404L19.296 10.656C18.496 9.34404 17.664 8.38404 16.8 7.77604C15.936 7.16804 14.88 6.86404 13.632 6.86404C12.288 6.86404 11.168 7.20004 10.272 7.87204C9.40799 8.54404 8.97599 9.44004 8.97599 10.56C8.97599 11.808 9.48799 12.72 10.512 13.296C11.568 13.84 12.832 14.336 14.304 14.784C15.296 15.104 16.4 15.488 17.616 15.936C18.864 16.352 20.064 16.944 21.216 17.712C22.368 18.448 23.312 19.44 24.048 20.688C24.784 21.936 25.152 23.52 25.152 25.44C25.152 27.456 24.656 29.232 23.664 30.768C22.672 32.304 21.264 33.504 19.44 34.368C17.616 35.232 15.424 35.664 12.864 35.664ZM37.3759 35.616C35.5839 35.616 33.9679 35.2 32.5279 34.368C31.0879 33.536 29.9519 32.352 29.1199 30.816C28.2879 29.248 27.8719 27.424 27.8719 25.344V10.08H34.3519V23.76C34.3519 25.904 34.7839 27.472 35.6479 28.464C36.5119 29.456 37.7439 29.952 39.3439 29.952C40.7199 29.952 41.9199 29.456 42.9439 28.464C43.9999 27.472 44.5279 25.904 44.5279 23.76V10.08H51.0079V35.04H44.7199V31.296C44.1119 32.736 43.2159 33.824 42.0319 34.56C40.8799 35.264 39.3279 35.616 37.3759 35.616ZM69.1826 35.664C66.9426 35.664 65.1986 35.232 63.9506 34.368C62.7346 33.504 61.7906 32.368 61.1186 30.96V35.04H54.8306V3.8147e-05H61.3106V13.92C61.9826 12.608 62.9266 11.552 64.1426 10.752C65.3586 9.95204 67.0386 9.55204 69.1826 9.55204C70.9106 9.55204 72.5106 9.90404 73.9826 10.608C75.4866 11.28 76.7986 12.224 77.9186 13.44C79.0386 14.624 79.9186 16.016 80.5586 17.616C81.1986 19.184 81.5186 20.864 81.5186 22.656C81.5186 25.056 80.9586 27.248 79.8386 29.232C78.7506 31.184 77.2786 32.752 75.4226 33.936C73.5666 35.088 71.4866 35.664 69.1826 35.664ZM68.1266 29.808C69.5026 29.808 70.7026 29.472 71.7266 28.8C72.7826 28.128 73.5986 27.248 74.1746 26.16C74.7506 25.04 75.0386 23.856 75.0386 22.608C75.0386 21.296 74.7506 20.096 74.1746 19.008C73.5986 17.92 72.7826 17.056 71.7266 16.416C70.7026 15.744 69.5026 15.408 68.1266 15.408C66.7186 15.408 65.4866 15.744 64.4306 16.416C63.3746 17.088 62.5586 17.968 61.9826 19.056C61.4066 20.144 61.1186 21.344 61.1186 22.656C61.1186 23.936 61.4066 25.12 61.9826 26.208C62.5586 27.296 63.3746 28.176 64.4306 28.848C65.4866 29.488 66.7186 29.808 68.1266 29.808ZM92.4371 35.664C88.2451 35.664 84.7891 34.208 82.0691 31.296L86.4371 27.312C88.2611 29.36 90.2131 30.384 92.2931 30.384C93.4131 30.384 94.2611 30.144 94.8371 29.664C95.4451 29.152 95.7491 28.528 95.7491 27.792C95.7491 27.344 95.6371 26.96 95.4131 26.64C95.2211 26.32 94.7891 26.016 94.1171 25.728C93.4771 25.44 92.5011 25.152 91.1891 24.864C88.9491 24.32 87.2851 23.648 86.1971 22.848C85.1091 22.048 84.3891 21.152 84.0371 20.16C83.6851 19.168 83.5091 18.144 83.5091 17.088C83.5091 14.912 84.3251 13.104 85.9571 11.664C87.6211 10.192 89.9091 9.45604 92.8211 9.45604C94.8371 9.45604 96.5651 9.76004 98.0051 10.368C99.4451 10.976 100.805 12.112 102.085 13.776L97.3811 17.376C96.7731 16.416 96.0851 15.728 95.3171 15.312C94.5811 14.896 93.7971 14.688 92.9651 14.688C92.0691 14.688 91.3171 14.864 90.7091 15.216C90.1331 15.568 89.8451 16.128 89.8451 16.896C89.8451 17.312 90.0371 17.728 90.4211 18.144C90.8051 18.528 91.7331 18.912 93.2051 19.296C95.6371 19.904 97.4931 20.624 98.7731 21.456C100.053 22.256 100.933 23.168 101.413 24.192C101.893 25.216 102.133 26.352 102.133 27.6C102.133 29.136 101.701 30.512 100.837 31.728C100.005 32.944 98.8531 33.904 97.3811 34.608C95.9411 35.312 94.2931 35.664 92.4371 35.664ZM116.563 35.664C114.771 35.664 113.091 35.328 111.523 34.656C109.987 33.984 108.627 33.056 107.443 31.872C106.259 30.656 105.331 29.264 104.659 27.696C104.019 26.096 103.699 24.384 103.699 22.56C103.699 20.128 104.259 17.936 105.379 15.984C106.531 14 108.099 12.416 110.083 11.232C112.099 10.048 114.371 9.45604 116.899 9.45604C119.171 9.42404 121.203 9.82404 122.995 10.656C124.787 11.488 126.211 12.64 127.267 14.112L122.275 18.192C121.699 17.328 120.947 16.64 120.019 16.128C119.123 15.616 118.115 15.36 116.995 15.36C115.619 15.36 114.419 15.696 113.395 16.368C112.371 17.008 111.571 17.872 110.995 18.96C110.451 20.048 110.179 21.248 110.179 22.56C110.179 23.84 110.467 25.04 111.043 26.16C111.651 27.248 112.467 28.128 113.491 28.8C114.547 29.44 115.763 29.76 117.139 29.76C118.387 29.76 119.443 29.488 120.307 28.944C121.171 28.368 121.923 27.648 122.563 26.784L127.267 30.864C126.083 32.368 124.611 33.552 122.851 34.416C121.123 35.248 119.027 35.664 116.563 35.664ZM129.831 35.04V10.08H136.119V14.832C136.535 13.04 137.383 11.68 138.663 10.752C139.943 9.79204 141.671 9.37604 143.847 9.50404V15.6H142.935C141.079 15.6 139.511 16.192 138.231 17.376C136.951 18.56 136.311 20.192 136.311 22.272V35.04H129.831ZM149.218 8.01604C148.13 8.01604 147.202 7.64804 146.434 6.91204C145.698 6.14404 145.33 5.23204 145.33 4.17604C145.33 3.15204 145.698 2.27204 146.434 1.53604C147.202 0.768037 148.13 0.384036 149.218 0.384036C150.338 0.384036 151.266 0.768037 152.002 1.53604C152.738 2.27204 153.106 3.15204 153.106 4.17604C153.106 5.26404 152.738 6.17604 152.002 6.91204C151.266 7.64804 150.338 8.01604 149.218 8.01604ZM146.002 35.04V10.08H152.482V35.04H146.002ZM170.667 35.664C168.427 35.664 166.683 35.232 165.435 34.368C164.219 33.504 163.275 32.368 162.603 30.96V35.04H156.315V3.8147e-05H162.795V13.92C163.467 12.608 164.411 11.552 165.627 10.752C166.843 9.95204 168.523 9.55204 170.667 9.55204C172.395 9.55204 173.995 9.90404 175.467 10.608C176.971 11.28 178.283 12.224 179.403 13.44C180.523 14.624 181.403 16.016 182.043 17.616C182.683 19.184 183.003 20.864 183.003 22.656C183.003 25.056 182.443 27.248 181.323 29.232C180.235 31.184 178.763 32.752 176.907 33.936C175.051 35.088 172.971 35.664 170.667 35.664ZM169.611 29.808C170.987 29.808 172.187 29.472 173.211 28.8C174.267 28.128 175.083 27.248 175.659 26.16C176.235 25.04 176.523 23.856 176.523 22.608C176.523 21.296 176.235 20.096 175.659 19.008C175.083 17.92 174.267 17.056 173.211 16.416C172.187 15.744 170.987 15.408 169.611 15.408C168.203 15.408 166.971 15.744 165.915 16.416C164.859 17.088 164.043 17.968 163.467 19.056C162.891 20.144 162.603 21.344 162.603 22.656C162.603 23.936 162.891 25.12 163.467 26.208C164.043 27.296 164.859 28.176 165.915 28.848C166.971 29.488 168.203 29.808 169.611 29.808ZM197.611 35.664C195.051 35.664 192.795 35.072 190.843 33.888C188.891 32.704 187.371 31.136 186.283 29.184C185.227 27.2 184.699 25.008 184.699 22.608C184.699 20.208 185.259 18.016 186.379 16.032C187.499 14.016 189.019 12.416 190.939 11.232C192.891 10.048 195.115 9.45604 197.611 9.45604C200.107 9.45604 202.299 10.048 204.187 11.232C206.107 12.416 207.595 14.016 208.651 16.032C209.739 18.016 210.283 20.208 210.283 22.608C210.283 22.96 210.267 23.328 210.235 23.712C210.203 24.096 210.155 24.496 210.091 24.912H191.419C191.771 26.384 192.475 27.584 193.531 28.512C194.619 29.44 195.979 29.904 197.611 29.904C199.019 29.904 200.235 29.584 201.259 28.944C202.315 28.304 203.131 27.504 203.707 26.544L208.747 30.336C207.755 31.904 206.267 33.184 204.283 34.176C202.299 35.168 200.075 35.664 197.611 35.664ZM197.515 15.024C195.979 15.024 194.667 15.488 193.579 16.416C192.491 17.344 191.771 18.56 191.419 20.064H203.755C203.403 18.688 202.667 17.504 201.547 16.512C200.459 15.52 199.115 15.024 197.515 15.024Z" fill="white"/>
            </svg>
        </div>
        <div class="bridge-yt-ball">
            <svg class="bridge-yt-arrow" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24.6532 13.488L28.7812 17.184L16.1572 30.288L3.5332 17.184L7.7092 13.488L13.2772 19.392L13.1332 0H19.1812L19.0372 19.488L24.6532 13.488Z" fill="white"/>
            </svg>
            <svg class="bridge-yt-hand" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.7501 0C16.9946 0 18.0001 1.00547 18.0001 2.25V16.875H13.5001V2.25C13.5001 1.00547 14.5056 0 15.7501 0ZM22.5001 11.25C23.7446 11.25 24.7501 12.2555 24.7501 13.5V18C24.7501 19.2445 23.7446 20.25 22.5001 20.25C21.2556 20.25 20.2501 19.2445 20.2501 18V13.5C20.2501 12.2555 21.2556 11.25 22.5001 11.25ZM27.0001 15.75C27.0001 14.5055 28.0056 13.5 29.2501 13.5C30.4946 13.5 31.5001 14.5055 31.5001 15.75V20.25C31.5001 21.4945 30.4946 22.5 29.2501 22.5C28.0056 22.5 27.0001 21.4945 27.0001 20.25V15.75ZM6.56024 3.6L12.3681 16.875H7.45321L2.43993 5.4C1.94071 4.26094 2.46102 2.93906 3.60009 2.43984C4.73915 1.94063 6.06806 2.46094 6.56024 3.6ZM8.45868 19.1602L8.44462 19.125H13.3595H15.1946C16.7485 19.125 18.0071 20.3836 18.0071 21.9375C18.0071 23.4914 16.7485 24.75 15.1946 24.75H11.2571C10.6384 24.75 10.1321 25.2563 10.1321 25.875C10.1321 26.4937 10.6384 27 11.2571 27H15.1946C17.9931 27 20.2571 24.7359 20.2571 21.9375V21.8953C20.9181 22.275 21.6845 22.5 22.5071 22.5C23.4352 22.5 24.2931 22.2188 25.0102 21.7406C25.622 23.4914 27.2954 24.75 29.2571 24.75C30.0798 24.75 30.8462 24.532 31.5071 24.1453V24.75C31.5071 30.9656 26.4727 36 20.2571 36H15.9188C12.9376 36 10.0759 34.8117 7.96649 32.7023L7.15087 31.8867C5.4493 30.1992 4.50009 27.907 4.50009 25.5234V23.625C4.50009 21.3258 6.22977 19.4273 8.45868 19.1602Z" fill="white"/>
            </svg>
        </div>
    `

    document.body.appendChild(container)
    return container
}
