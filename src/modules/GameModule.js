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

import EventLite from 'event-lite'
import ModuleBase from './ModuleBase'
import { EVENT_NAME } from '../constants'
import { createProgressLogo } from '../common/utils'

class GameModule extends ModuleBase {
    get visibilityState() {
        return this._platformBridge.visibilityState
    }

    constructor(platformBridge) {
        super(platformBridge)

        this._platformBridge.on(
            EVENT_NAME.VISIBILITY_STATE_CHANGED,
            (state) => this.emit(EVENT_NAME.VISIBILITY_STATE_CHANGED, state),
        )

        if (!this._platformBridge.options.disableLoadingLogo) {
            createProgressLogo()
        }
    }

    _currentLoadingProgress = null

    _loadingProcessCompleted = false

    setLoadingProgress(percent, isFallback = false) {
        if (this._loadingProcessCompleted) {
            return
        }

        if (isFallback && this._currentLoadingProgress !== null) {
            return
        }

        const fill = document.getElementById('fillRect')
        const gradientMover = document.getElementById('gradientMover')
        const logo = document.getElementById('logo')
        const loadingOverlay = document.getElementById('loading-overlay')

        if (!fill || !gradientMover || !logo || !loadingOverlay) {
            return
        }

        this._currentLoadingProgress = percent

        const progress = Math.max(0, Math.min(100, percent))
        const translateY = 100 - progress
        fill.style.transform = `translateY(${translateY}%)`

        if (progress === 100) {
            this._loadingProcessCompleted = true

            setTimeout(() => {
                fill.style.display = 'none'
                gradientMover.style.display = 'block'
                gradientMover.classList.add('gradient-mover')
            }, 400)
            setTimeout(() => logo.classList.add('logo-fade-out'), 900)
            setTimeout(() => loadingOverlay.remove(), 1400)
        } else {
            gradientMover.classList.remove('gradient-mover')
        }
    }
}

EventLite.mixin(GameModule.prototype)
export default GameModule
