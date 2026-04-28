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

import { applyEventBusMixin } from '../common/EventBus'
import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import {
    EVENT_NAME,
    PLATFORM_ID,
    type PlatformId,
    type VisibilityState,
} from '../constants'
import { createProgressLogo, applySafeAreaStyles } from '../common/utils'
import type { AnyRecord, EventEmitter } from '../types/common'

export interface GameBridgeOptions {
    disableLoadingLogo?: boolean
    showFullLoadingLogo?: boolean
    showLoadingText?: boolean
    game?: {
        adaptToSafeArea?: boolean
        [key: string]: unknown
    }
    [key: string]: unknown
}

export interface GameBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    visibilityState: VisibilityState | null
    options: GameBridgeOptions
}

interface GameModule extends EventEmitter {}

class GameModule extends ModuleBase<GameBridgeContract> {
    get visibilityState(): VisibilityState | null {
        return this._platformBridge.visibilityState
    }

    protected _currentLoadingProgress: number | null = null

    protected _loadingProcessCompleted = false

    constructor(platformBridge: GameBridgeContract) {
        super(platformBridge)

        this._forwardEvent(EVENT_NAME.VISIBILITY_STATE_CHANGED)

        if (!this._platformBridge.options.disableLoadingLogo) {
            const showFullLogo = this._platformBridge.platformId === PLATFORM_ID.YANDEX
                || this._platformBridge.platformId === PLATFORM_ID.Y8
                ? false
                : this._platformBridge.options.showFullLoadingLogo === true
            const showLoadingText = this._platformBridge.platformId === PLATFORM_ID.XIAOMI
                || this._platformBridge.options.showLoadingText === true
            createProgressLogo(showFullLogo, showLoadingText)
        }

        if ((this._platformBridge.options as AnyRecord)?.game
            && (this._platformBridge.options.game as AnyRecord)?.adaptToSafeArea) {
            applySafeAreaStyles()
        }
    }

    setLoadingProgress(percent: number, isFallback = false): void {
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

applyEventBusMixin(GameModule.prototype)
export default GameModule
