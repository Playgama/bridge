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
import bridgeConfig from '../../lib/bridge-config'
import type { AnyRecord } from '../../utils'
import { EVENT_NAME } from '../../constants'
import { INTERSTITIAL_STATE, REWARDED_STATE } from '../advertisement/constants'
import {
    STYLE_ID,
    CONTAINER_ID,
    DEFAULT_TITLE,
    GAMES_PER_SHOW,
    STYLES,
    CROSS_PROMO_SOURCE,
    type CrossPromoSource,
} from './constants'
import {
    normalizeConfigGame,
    normalizePlatformGame,
    pickRandomGames,
} from './helpers'
import type {
    CrossPromoConfig,
    Game,
    CrossPromoBridgeContract,
} from './types'

class CrossPromoModule extends ModuleBase<CrossPromoBridgeContract> {
    get isVisible(): boolean {
        return this.#container !== null
    }

    #container: HTMLDivElement | null = null

    #source: CrossPromoSource = CROSS_PROMO_SOURCE.CONFIG

    initialize(platformBridge: CrossPromoBridgeContract): this {
        super.initialize(platformBridge)
        this.#source = this.#resolveSource()
        this.#subscribeToAdEvents()
        return this
    }

    // Public API: the full games list from the configured source, normalized to
    // Game[] with complete info per game. Resolves to an empty array when the
    // source is unsupported, errors, or has no games.
    getGamesList(): Promise<Game[]> {
        if (this.#source === CROSS_PROMO_SOURCE.PLATFORM) {
            return this.#getPlatformGames()
        }

        return Promise.resolve(this.#getConfigGames())
    }

    async show(): Promise<void> {
        if (this.#container) {
            return
        }

        const games = await this.getGamesList()

        // A concurrent show()/hide() may have changed state while we awaited.
        if (this.#container) {
            return
        }

        const renderable = games.filter((game) => game && game.url)
        if (renderable.length === 0) {
            return
        }

        const selectedGames = pickRandomGames(renderable, GAMES_PER_SHOW)

        this.#injectStyles()
        this.#container = this.#createContainer(selectedGames, this.#getConfig().title)
        document.body.appendChild(this.#container)
    }

    hide(): void {
        if (!this.#container) {
            return
        }

        this.#container.remove()
        this.#container = null
    }

    #resolveSource(): CrossPromoSource {
        const { source } = this.#getConfig()
        if (source === CROSS_PROMO_SOURCE.PLATFORM || source === CROSS_PROMO_SOURCE.CONFIG) {
            return source
        }
        return CROSS_PROMO_SOURCE.CONFIG
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
        return bridgeConfig.getValues().crossPromo ?? {}
    }

    #getConfigGames(): Game[] {
        const { games } = this.#getConfig()
        if (!Array.isArray(games)) {
            return []
        }
        return games
            .filter((game) => game && game.url)
            .map(normalizeConfigGame)
    }

    // Reads the catalog from the platform SDK on platforms that support it;
    // resolves to an empty array elsewhere or on error.
    #getPlatformGames(): Promise<Game[]> {
        if (!this._platformBridge.isPlatformGamesListSupported) {
            return Promise.resolve([])
        }
        return this._platformBridge.getGamesList()
            .then((games) => (Array.isArray(games) ? (games as AnyRecord[]).map(normalizePlatformGame) : []))
            .catch(() => [])
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

    #createContainer(games: Game[], title?: string): HTMLDivElement {
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

    #createTile(game: Game): HTMLAnchorElement {
        const tile = document.createElement('a')
        tile.className = 'bridge-cp-tile'
        tile.href = game.url
        tile.target = '_blank'
        tile.rel = 'noopener noreferrer'

        const thumb = document.createElement('div')
        thumb.className = 'bridge-cp-thumb'
        if (game.iconUrl) {
            thumb.style.backgroundImage = `url('${game.iconUrl.replace(/'/g, "\\'")}')`
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
