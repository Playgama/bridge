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

import eventBus, { applyEventBusMixin } from '../common/EventBus'
import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import {
    EVENT_NAME,
    MODULE_NAME,
    PLATFORM_MESSAGE,
    type PlatformId,
    type PlatformMessage,
} from '../constants'
import analyticsModule from './AnalyticsModule'
import type { EventEmitter } from '../types/common'

export interface PlatformMessageOptions {
    world?: unknown
    level?: unknown
    [key: string]: unknown
}

export type GameByIdOptions = Record<string, unknown> & Partial<Record<PlatformId, unknown>>

export interface PlatformBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    platformSdk: unknown
    platformLanguage: string
    platformPayload: string | null
    platformTld: string | null
    isPlatformGetAllGamesSupported: boolean
    isPlatformGetGameByIdSupported: boolean
    isPlatformAudioEnabled: boolean
    isPlatformPaused: boolean
    sendMessage(message: string, options?: PlatformMessageOptions): Promise<unknown>
    sendCustomMessage(id: string, options?: unknown): Promise<unknown>
    getServerTime(): Promise<unknown>
    getAllGames(): Promise<unknown>
    getGameById(options?: unknown): Promise<unknown>
}

interface PlatformAnalyticsModule {
    send(eventType: string, data?: Record<string, unknown>): void
}

interface PlatformModule extends EventEmitter {}

class PlatformModule extends ModuleBase<PlatformBridgeContract> {
    get id(): PlatformId {
        return this._platformBridge.platformId
    }

    get sdk(): unknown {
        return this._platformBridge.platformSdk
    }

    get language(): string {
        return this._platformBridge.platformLanguage
    }

    get payload(): string | null {
        return this._platformBridge.platformPayload
    }

    get tld(): string | null {
        return this._platformBridge.platformTld
    }

    get isGetAllGamesSupported(): boolean {
        return this._platformBridge.isPlatformGetAllGamesSupported
    }

    get isGetGameByIdSupported(): boolean {
        return this._platformBridge.isPlatformGetGameByIdSupported
    }

    get isAudioEnabled(): boolean {
        return this._platformBridge.isPlatformAudioEnabled
    }

    get isPaused(): boolean {
        return this._platformBridge.isPlatformPaused
    }

    #isGameReadyMessageSent = false

    #startTime = performance.now()

    constructor(platformBridge: PlatformBridgeContract) {
        super(platformBridge)

        this._forwardEvent(EVENT_NAME.AUDIO_STATE_CHANGED)
        this._forwardEvent(EVENT_NAME.PAUSE_STATE_CHANGED)
    }

    sendMessage(message: PlatformMessage | string, options: PlatformMessageOptions = {}): Promise<unknown> {
        const analyticsData: Record<string, unknown> = {}

        if (message === PLATFORM_MESSAGE.GAME_READY) {
            if (this.#isGameReadyMessageSent) {
                return Promise.reject()
            }

            this.#isGameReadyMessageSent = true

            const endTime = performance.now()
            analyticsData.time_s = ((endTime - this.#startTime) / 1000).toFixed(2)

            const overlay = document.getElementById('loading-overlay')
            if (overlay) {
                overlay.remove()
            }
        }

        if (options.world !== undefined) {
            analyticsData.world = String(options.world)
        }

        if (options.level !== undefined) {
            analyticsData.level = String(options.level)
        }

        (analyticsModule as unknown as PlatformAnalyticsModule).send(
            `${MODULE_NAME.PLATFORM}_message_${message}`,
            analyticsData,
        )

        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, message)

        return this._platformBridge.sendMessage(message, options)
    }

    sendCustomMessage(id: string, options?: unknown): Promise<unknown> {
        (analyticsModule as unknown as PlatformAnalyticsModule).send(
            `${MODULE_NAME.PLATFORM}_custom_message`,
            { id },
        )

        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, id)

        return this._platformBridge.sendCustomMessage(id, options)
    }

    getServerTime(): Promise<unknown> {
        return this._platformBridge.getServerTime()
    }

    getAllGames(): Promise<unknown> {
        return this._platformBridge.getAllGames()
    }

    getGameById(options?: GameByIdOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.getGameById(platformDependedOptions as GameByIdOptions)
            }
        }

        return this._platformBridge.getGameById(options)
    }
}

applyEventBusMixin(PlatformModule.prototype)
export default PlatformModule
