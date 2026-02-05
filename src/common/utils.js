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

import { BANNER_CONTAINER_ID, BANNER_POSITION, ORIENTATION_OVERLAY_ID } from '../constants'

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
}, config = {}) => new Promise((resolve) => {
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
            'This is placeholder for the Ad.<br><br>Playgama helps games reach players worldwide.',
        ]
        const textElement = document.getElementById('bridge-ad-failure-popup-text')
        textElement.innerHTML = messages[Math.floor(Math.random() * messages.length)]

        popup.style.display = 'grid'
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
