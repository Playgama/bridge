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

export function showInfoPopup(message: string): Promise<void> {
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

    let overlay = document.getElementById('bridge-info-popup-overlay') as HTMLDivElement | null
    if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'bridge-info-popup-overlay'
        document.body.appendChild(overlay)
    }

    let popup = document.getElementById('bridge-info-popup') as HTMLDivElement | null
    if (!popup) {
        popup = document.createElement('div')
        popup.id = 'bridge-info-popup'
        overlay.appendChild(popup)
    }

    popup.innerHTML = ''

    const emoji = document.createElement('div')
    emoji.id = 'bridge-info-popup-emoji'
    emoji.textContent = '🎬'
    popup.appendChild(emoji)

    const title = document.createElement('h3')
    title.id = 'bridge-info-popup-title'
    title.textContent = message
    popup.appendChild(title)

    const button = document.createElement('button')
    button.id = 'bridge-info-popup-button'
    button.textContent = 'Continue'
    popup.appendChild(button)

    const overlayEl = overlay
    return new Promise((resolve) => {
        button.onclick = () => {
            overlayEl.style.display = 'none'
            resolve()
        }

        overlayEl.style.display = 'flex'
    })
}

export function showAdFailurePopup(): Promise<void> {
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

    let popup = document.getElementById('bridge-ad-failure-popup') as HTMLDivElement | null
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

    const closeButton = document.getElementById('bridge-ad-failure-popup-close') as HTMLButtonElement | null

    const popupEl = popup
    return new Promise((resolve) => {
        const closePopup = (): void => {
            popupEl.style.display = 'none'
            resolve()
        }

        if (closeButton) {
            closeButton.onclick = closePopup
        }
        popupEl.onclick = closePopup

        const messages = [
            'If you see this message, no Ad was returned for the Ad request.<br><br>Please ask the developer to check the Ad setup.',
            'This is placeholder for the Ad. Playgama helps games reach players worldwide.',
        ]
        const textElement = document.getElementById('bridge-ad-failure-popup-text')
        if (textElement) {
            textElement.innerHTML = messages[Math.floor(Math.random() * messages.length)]
        }

        popupEl.style.display = 'grid'
    })
}
