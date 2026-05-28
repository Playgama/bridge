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
const GAMES_PER_SHOW = 4
const ICON_ASPECT_RATIO = '183 / 256'

const STYLES = `
    #${CONTAINER_ID} {
        position: fixed;
        inset: 0;
        z-index: 9999998;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        animation: bridge-cp-fade-in 180ms ease-out;
        padding: 16px;
        box-sizing: border-box;
    }

    #${CONTAINER_ID} .bridge-cp-modal {
        position: relative;
        width: 100%;
        max-width: 640px;
        max-height: 100%;
        background: #212121;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #ffffff;
    }

    #${CONTAINER_ID} .bridge-cp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
    }

    #${CONTAINER_ID} .bridge-cp-title {
        margin: 0;
        color: #ffffff;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.2px;
    }

    #${CONTAINER_ID} .bridge-cp-close {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #aaaaaa;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 200ms ease, color 200ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
    }

    #${CONTAINER_ID} .bridge-cp-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
        -webkit-overflow-scrolling: touch;
    }

    #${CONTAINER_ID} .bridge-cp-tile {
        display: flex;
        flex-direction: column;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
    }

    #${CONTAINER_ID} .bridge-cp-thumb {
        position: relative;
        width: 100%;
        aspect-ratio: ${ICON_ASPECT_RATIO};
        border-radius: 12px;
        overflow: hidden;
        background: #333333 center/cover no-repeat;
        transition: transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 250ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-tile:hover .bridge-cp-thumb {
        transform: translateY(-4px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }

    #${CONTAINER_ID} .bridge-cp-name {
        margin-top: 8px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        color: #f1f1f1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 200ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-tile:hover .bridge-cp-name {
        color: #3ea6ff;
    }

    @keyframes bridge-cp-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @media (min-width: 600px) {
        #${CONTAINER_ID} .bridge-cp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    }
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

        const selectedGames = this.#pickRandomGames(games, GAMES_PER_SHOW)

        this.#injectStyles()
        this.#container = this.#createContainer(selectedGames, config.title)
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

    #pickRandomGames(games, count) {
        if (games.length <= count) {
            return games.slice()
        }

        const pool = games.slice()
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = pool[i]
            pool[i] = pool[j]
            pool[j] = temp
        }
        return pool.slice(0, count)
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

        const header = document.createElement('div')
        header.className = 'bridge-cp-header'

        const titleEl = document.createElement('h2')
        titleEl.className = 'bridge-cp-title'
        titleEl.textContent = typeof title === 'string' && title.length > 0 ? title : DEFAULT_TITLE
        header.appendChild(titleEl)

        const closeButton = document.createElement('button')
        closeButton.className = 'bridge-cp-close'
        closeButton.type = 'button'
        closeButton.setAttribute('aria-label', 'Close')
        closeButton.textContent = '×'
        header.appendChild(closeButton)

        modal.appendChild(header)

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

        const thumb = document.createElement('div')
        thumb.className = 'bridge-cp-thumb'
        if (game.icon) {
            thumb.style.backgroundImage = `url('${game.icon.replace(/'/g, "\\'")}')`
        }
        tile.appendChild(thumb)

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
