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

import eventBus, { applyEventBusMixin } from '../../lib/EventBus'
import ModuleBase, { type PlatformBridgeLike } from '../ModuleBase'
import { EVENT_NAME, MODULE_NAME, type LaunchSource } from '../../constants'
import {
    PLATFORM_MESSAGE,
    type PlatformId,
    type PlatformMessage,
} from './constants'
import { internalAnalytics } from '../analytics'
import type { EventEmitter } from '../../lib/EventBus'

export interface PlatformMessageOptions {
    world?: unknown
    level?: unknown
    [key: string]: unknown
}

export interface PlatformBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    platformSdk: unknown
    platformLanguage: string
    platformPayload: string | null
    platformTld: string | null
    launchSource: LaunchSource | null
    isPlatformExternalCallsSupported: boolean
    isPlatformExternalLinksAllowed: boolean
    isPlatformAudioEnabled: boolean
    isPlatformPaused: boolean
    sendMessage(message: string, options?: PlatformMessageOptions): Promise<unknown>
    sendCustomMessage(id: string, options?: unknown): Promise<unknown>
    getServerTime(): Promise<unknown>
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

    get launchSource(): LaunchSource | null {
        return this._platformBridge.launchSource
    }

    get isExternalCallsSupported(): boolean {
        return this._platformBridge.isPlatformExternalCallsSupported
    }

    get isExternalLinksAllowed(): boolean {
        return this._platformBridge.isPlatformExternalLinksAllowed
    }

    get isAudioEnabled(): boolean {
        return this._platformBridge.isPlatformAudioEnabled
    }

    get isPaused(): boolean {
        return this._platformBridge.isPlatformPaused
    }

    #isGameReadyMessageSent = false

    #startTime = 0

    #messagesExcludedFromAnalytics = new Set<string>([
        PLATFORM_MESSAGE.GAMEPLAY_STARTED,
        PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
        PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
        PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
    ])

    initialize(platformBridge: PlatformBridgeContract): this {
        super.initialize(platformBridge)

        this.#startTime = performance.now()
        this._forwardEvent(EVENT_NAME.AUDIO_STATE_CHANGED)
        this._forwardEvent(EVENT_NAME.PAUSE_STATE_CHANGED)
        return this
    }

    sendMessage(message: PlatformMessage | string, rawOptions?: PlatformMessageOptions | null): Promise<unknown> {
        // Engine integrations (e.g. Godot) can pass an explicit null instead of omitting the argument
        const options = rawOptions ?? {}

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

        if (!this.#messagesExcludedFromAnalytics.has(message)) {
            internalAnalytics.send(
                `${MODULE_NAME.PLATFORM}_message_${message}`,
                analyticsData,
            )
        }

        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, message)

        return this._platformBridge.sendMessage(message, options)
    }

    sendCustomMessage(id: string, options?: unknown): Promise<unknown> {
        internalAnalytics.send(
            `${MODULE_NAME.PLATFORM}_custom_message`,
            { id },
        )

        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, id)

        return this._platformBridge.sendCustomMessage(id, options)
    }

    getServerTime(): Promise<unknown> {
        return this._platformBridge.getServerTime()
    }
}

applyEventBusMixin(PlatformModule.prototype)
export default PlatformModule
