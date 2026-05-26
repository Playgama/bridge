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

import configFileModule from './ConfigFileModule'

const STYLE_ID = 'bridge-cross-promo-styles'
const CONTAINER_ID = 'bridge-cross-promo'
const DEFAULT_TITLE = 'More games'

const STYLES = `
    #${CONTAINER_ID} {
        position: fixed;
        inset: 0;
        z-index: 9999998;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        animation: bridge-cp-fade-in 180ms ease-out;
        padding: 16px;
        box-sizing: border-box;
    }

    #${CONTAINER_ID} .bridge-cp-modal {
        position: relative;
        width: 100%;
        max-width: 720px;
        max-height: 100%;
        background: linear-gradient(180deg, #1f1733 0%, #120b22 100%);
        border-radius: 24px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
        padding: 24px 20px 20px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    #${CONTAINER_ID} .bridge-cp-title {
        margin: 0 40px 16px 4px;
        color: #ffffff;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
    }

    #${CONTAINER_ID} .bridge-cp-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 120ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-close:hover {
        background: rgba(255, 255, 255, 0.22);
    }

    #${CONTAINER_ID} .bridge-cp-close svg {
        width: 16px;
        height: 16px;
    }

    #${CONTAINER_ID} .bridge-cp-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
        -webkit-overflow-scrolling: touch;
    }

    #${CONTAINER_ID} .bridge-cp-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 12px 8px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.06);
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        transition: background 150ms ease, transform 150ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-tile:hover {
        background: rgba(255, 255, 255, 0.12);
        transform: translateY(-2px);
    }

    #${CONTAINER_ID} .bridge-cp-tile:active {
        transform: translateY(0);
    }

    #${CONTAINER_ID} .bridge-cp-icon {
        width: 100%;
        aspect-ratio: 1 / 1;
        max-width: 140px;
        border-radius: 14px;
        background: #2b1f47 center/cover no-repeat;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }

    #${CONTAINER_ID} .bridge-cp-name {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        text-align: center;
        line-height: 1.25;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    @keyframes bridge-cp-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @media (min-width: 600px) {
        #${CONTAINER_ID} .bridge-cp-modal {
            padding: 28px 28px 24px;
        }

        #${CONTAINER_ID} .bridge-cp-title {
            font-size: 24px;
            margin-bottom: 20px;
        }

        #${CONTAINER_ID} .bridge-cp-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
        }

        #${CONTAINER_ID} .bridge-cp-name {
            font-size: 15px;
        }
    }

    @media (min-width: 960px) {
        #${CONTAINER_ID} .bridge-cp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    }
`

const CLOSE_ICON_SVG = `
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M1.5 1.5 14.5 14.5M14.5 1.5 1.5 14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
`

class CrossPromoModule {
    get isVisible() {
        return this.#container !== null
    }

    #platformId = null

    #container = null

    init(platformId) {
        this.#platformId = platformId
    }

    show() {
        if (this.#container) {
            return
        }

        const config = this.#getConfig()
        const games = this.#getGames(config)
        if (games.length === 0) {
            return
        }

        this.#injectStyles()
        this.#container = this.#createContainer(games, config.title)
        document.body.appendChild(this.#container)
    }

    hide() {
        if (!this.#container) {
            return
        }

        this.#container.remove()
        this.#container = null
    }

    #getConfig() {
        if (!this.#platformId) {
            return {}
        }

        const options = configFileModule.getPlatformOptions(this.#platformId)
        return options?.crossPromo ?? {}
    }

    #getGames(config) {
        const games = config?.games
        if (!Array.isArray(games)) {
            return []
        }
        return games.filter((game) => game && game.url)
    }

    #injectStyles() {
        if (document.getElementById(STYLE_ID)) {
            return
        }

        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = STYLES
        document.head.appendChild(style)
    }

    #createContainer(games, title) {
        const container = document.createElement('div')
        container.id = CONTAINER_ID

        const modal = document.createElement('div')
        modal.className = 'bridge-cp-modal'

        const titleEl = document.createElement('h2')
        titleEl.className = 'bridge-cp-title'
        titleEl.textContent = typeof title === 'string' && title.length > 0 ? title : DEFAULT_TITLE
        modal.appendChild(titleEl)

        const closeButton = document.createElement('button')
        closeButton.className = 'bridge-cp-close'
        closeButton.type = 'button'
        closeButton.setAttribute('aria-label', 'Close')
        closeButton.innerHTML = CLOSE_ICON_SVG
        modal.appendChild(closeButton)

        const grid = document.createElement('div')
        grid.className = 'bridge-cp-grid'
        games.forEach((game) => {
            grid.appendChild(this.#createTile(game))
        })
        modal.appendChild(grid)

        container.appendChild(modal)

        container.addEventListener('click', (event) => {
            if (event.target === container) {
                this.hide()
            }
        })

        modal.addEventListener('click', (event) => {
            const tile = event.target.closest('.bridge-cp-tile')
            const close = event.target.closest('.bridge-cp-close')

            if (close) {
                event.preventDefault()
                this.hide()
                return
            }

            if (tile) {
                return
            }

            this.hide()
        })

        return container
    }

    #createTile(game) {
        const tile = document.createElement('a')
        tile.className = 'bridge-cp-tile'
        tile.href = game.url
        tile.target = '_blank'
        tile.rel = 'noopener noreferrer'

        const icon = document.createElement('div')
        icon.className = 'bridge-cp-icon'
        if (game.icon) {
            icon.style.backgroundImage = `url('${game.icon.replace(/'/g, "\\'")}')`
        }
        tile.appendChild(icon)

        if (game.name) {
            const name = document.createElement('div')
            name.className = 'bridge-cp-name'
            name.textContent = game.name
            tile.appendChild(name)
        }

        return tile
    }
}

export { CrossPromoModule }
export default new CrossPromoModule()
