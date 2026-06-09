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

import ModuleBase from '../ModuleBase'
import eventBus from '../../lib/EventBus'
import { EVENT_NAME } from '../../constants'
import { INTERSTITIAL_STATE, REWARDED_STATE } from '../advertisement/constants'
import {
    STYLE_ID,
    CONTAINER_ID,
    DEFAULT_TITLE,
    GAMES_PER_SHOW,
    STYLES,
} from './constants'
import type {
    CrossPromoConfig,
    CrossPromoGame,
    CrossPromoBridgeContract,
} from './types'

class CrossPromoModule extends ModuleBase<CrossPromoBridgeContract> {
    get isVisible(): boolean {
        return this.#container !== null
    }

    #container: HTMLDivElement | null = null

    initialize(platformBridge: CrossPromoBridgeContract): this {
        super.initialize(platformBridge)
        this.#subscribeToAdEvents()
        return this
    }

    show(): void {
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

    hide(): void {
        if (!this.#container) {
            return
        }

        this.#container.remove()
        this.#container = null
    }

    #subscribeToAdEvents(): void {
        eventBus.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state: unknown) => {
            if (state === INTERSTITIAL_STATE.LOADING || state === INTERSTITIAL_STATE.OPENED) {
                this.hide()
            }
        })

        eventBus.on(EVENT_NAME.REWARDED_STATE_CHANGED, (state: unknown) => {
            if (state === REWARDED_STATE.LOADING || state === REWARDED_STATE.OPENED) {
                this.hide()
            }
        })
    }

    #getConfig(): CrossPromoConfig {
        return this._platformBridge?.options?.crossPromo ?? {}
    }

    #getGames(config: CrossPromoConfig): CrossPromoGame[] {
        const games = config?.games
        if (!Array.isArray(games)) {
            return []
        }
        return games.filter((game) => game && game.url)
    }

    #pickRandomGames(games: CrossPromoGame[], count: number): CrossPromoGame[] {
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

    #injectStyles(): void {
        if (document.getElementById(STYLE_ID)) {
            return
        }

        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = STYLES
        document.head.appendChild(style)
    }

    #createContainer(games: CrossPromoGame[], title?: string): HTMLDivElement {
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
            const target = event.target as HTMLElement
            const tile = target.closest('.bridge-cp-tile')
            const close = target.closest('.bridge-cp-close')

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

    #createTile(game: CrossPromoGame): HTMLAnchorElement {
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

export default CrossPromoModule
