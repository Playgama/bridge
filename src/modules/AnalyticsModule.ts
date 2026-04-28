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

import {
    MODULE_NAME, PLATFORM_ID, TIMESTAMP_URL, type PlatformId,
    DeviceOs, DeviceType,
} from '../constants'
import packageJson from '../../package.json'
import { generateRandomId, getGuestUser } from '../common/utils'
import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'

const API_URL = 'https://playgama.com/api/events/v3/bridge/analytics'
const DISCORD_API_URL = '/playgama/api/events/v3/bridge/analytics'
const FLUSH_INTERVAL = 15000
const SEND_ATTEMPTS = 2

export interface AnalyticsBridgeOptions {
    sendAnalyticsEvents?: boolean
    [key: string]: unknown
}

export interface AnalyticsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    playerId: string | null
    deviceType: DeviceType
    deviceOs: DeviceOs
    options: AnalyticsBridgeOptions
    additionalData?: { clid?: string } & Record<string, unknown>
}

interface AnalyticsEvent {
    event_name: string
    timestamp: string
    data: Record<string, unknown>
}

interface AnalyticsMeta {
    bridge_version: string
    platform_id: PlatformId
    game_id: string | null
    session_id: string
    player_id: string | null
    player_guest_id: string | null
    device_type: DeviceType
    device_os: DeviceOs
    clid: string
}

interface AnalyticsPayload {
    meta: AnalyticsMeta
    events: AnalyticsEvent[]
}

class AnalyticsModule extends ModuleBase<AnalyticsBridgeContract> {
    #eventQueue: AnalyticsEvent[] = []

    #flushTimer: ReturnType<typeof setInterval> | null = null

    #gameId: string | null = null

    #playerGuestId: string | null = null

    #sessionId: string

    #failedAttempts = 0

    #isDisabled = false

    #visibilityHandler: (() => void) | null = null

    #pagehideHandler: (() => void) | null = null

    #timeDiff = 0

    #isCompressionSupported = typeof CompressionStream !== 'undefined'

    constructor() {
    // Singleton: created without a real bridge; bridge is injected via
    // initialize(). Cast to satisfy the typed constructor signature.
        super(undefined as never)
        this.#sessionId = this.#generateSessionId()
    }

    initialize(platformBridge: AnalyticsBridgeContract): this {
        this._platformBridge = platformBridge
        if (this._platformBridge.options?.sendAnalyticsEvents === false) {
            this.#isDisabled = true
        }

        const { href } = window.location
        if (href.startsWith('file://') || href.includes('localhost') || href.includes('127.0.0.1')) {
            this.#isDisabled = true
        }

        this.#fetchTimeDiff()
        this.#gameId = this.#extractGameId()
        this.#playerGuestId = getGuestUser().id

        this.send(`${MODULE_NAME.CORE}_initialization_started`)
        this.#startFlushInterval()
        this.#setupPageUnloadHandler()

        return this
    }

    send(eventType: string, data: Record<string, unknown> = {}): void {
        if (this.#isDisabled) {
            return
        }

        const event = this.#createEvent(eventType, data)
        this.#eventQueue.push(event)
    }

    #generateSessionId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }

        return generateRandomId()
    }

    async #fetchTimeDiff(): Promise<void> {
        try {
            const response = await fetch(TIMESTAMP_URL)
            if (!response.ok) {
                return
            }

            const data = await response.json() as { timestamp: number }
            this.#timeDiff = data.timestamp * 1000 - Date.now()

            for (let i = 0; i < this.#eventQueue.length; i++) {
                const event = this.#eventQueue[i]
                const localTime = new Date(event.timestamp).getTime()
                event.timestamp = new Date(localTime + this.#timeDiff).toISOString()
            }
        } catch {
            // Keep timeDiff = 0, use local time as fallback
        }
    }

    #createEvent(eventType: string, data: Record<string, unknown> = {}): AnalyticsEvent {
        return {
            event_name: eventType,
            timestamp: new Date(Date.now() + this.#timeDiff).toISOString(),
            data,
        }
    }

    #createMeta(): AnalyticsMeta {
        return {
            bridge_version: packageJson.version,
            platform_id: this._platformBridge.platformId,
            game_id: this.#gameId,
            session_id: this.#sessionId,
            player_id: this._platformBridge.playerId,
            player_guest_id: this.#playerGuestId,
            device_type: this._platformBridge.deviceType,
            device_os: this._platformBridge.deviceOs,
            clid: this._platformBridge.additionalData?.clid ?? '',
        }
    }

    async #compressData(data: AnalyticsPayload): Promise<Blob> {
        const json = JSON.stringify(data)
        const stream = new Blob([json]).stream()
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
        return new Response(compressedStream).blob()
    }

    #getApiUrl(): string {
        if (this._platformBridge.platformId === PLATFORM_ID.DISCORD) {
            return DISCORD_API_URL
        }
        return API_URL
    }

    #createPayload(events: AnalyticsEvent[]): AnalyticsPayload {
        return {
            meta: this.#createMeta(),
            events,
        }
    }

    async #flush(): Promise<void> {
        if (this.#eventQueue.length === 0 || this.#isDisabled) {
            return
        }

        const events = [...this.#eventQueue]
        this.#eventQueue = []

        const success = await this.#sendRequest(this.#createPayload(events))
        if (!success && !this.#isDisabled) {
            this.#eventQueue = [...events, ...this.#eventQueue]
        }
    }

    async #sendRequest(payload: AnalyticsPayload): Promise<boolean> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            let body: BodyInit

            if (this.#isCompressionSupported) {
                try {
                    headers['Content-Encoding'] = 'gzip'
                    body = await this.#compressData(payload)
                } catch {
                    delete headers['Content-Encoding']
                    body = JSON.stringify(payload)
                }
            } else {
                body = JSON.stringify(payload)
            }

            const response = await fetch(this.#getApiUrl(), {
                method: 'POST',
                headers,
                body,
            })

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`)
            }

            this.#failedAttempts = 0
            return true
        } catch {
            this.#failedAttempts += 1
            if (this.#failedAttempts >= SEND_ATTEMPTS) {
                this.#disable()
            }
            return false
        }
    }

    #flushSync(): void {
        if (this.#eventQueue.length === 0 || this.#isDisabled) {
            return
        }

        const events = [...this.#eventQueue]
        this.#eventQueue = []

        const url = this.#getApiUrl()
        const payload = this.#createPayload(events)
        const body = JSON.stringify(payload)

        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' })
            navigator.sendBeacon(url, blob)
        }
    }

    #setupPageUnloadHandler(): void {
        this.#pagehideHandler = () => {
            this.#flushSync()
        }

        this.#visibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                this.#flushSync()
            }
        }

        document.addEventListener('visibilitychange', this.#visibilityHandler)
        window.addEventListener('pagehide', this.#pagehideHandler)
    }

    #disable(): void {
        this.#isDisabled = true
        this.#eventQueue = []

        if (this.#flushTimer) {
            clearInterval(this.#flushTimer)
            this.#flushTimer = null
        }

        if (this.#visibilityHandler) {
            document.removeEventListener('visibilitychange', this.#visibilityHandler)
            this.#visibilityHandler = null
        }

        if (this.#pagehideHandler) {
            window.removeEventListener('pagehide', this.#pagehideHandler)
            this.#pagehideHandler = null
        }
    }

    #extractGameId(): string | null {
        const { options, platformId } = this._platformBridge

        const optionKeyMap: Partial<Record<PlatformId, string>> = {
            [PLATFORM_ID.GAME_DISTRIBUTION]: 'gameId',
            [PLATFORM_ID.Y8]: 'gameId',
            [PLATFORM_ID.MSN]: 'gameId',
            [PLATFORM_ID.HUAWEI]: 'appId',
            [PLATFORM_ID.DISCORD]: 'appId',
            [PLATFORM_ID.GAMEPUSH]: 'projectId',
            [PLATFORM_ID.MICROSOFT_STORE]: 'gameId',
        }

        const optionKey = optionKeyMap[platformId]
        const gameId = optionKey ? (options as Record<string, unknown>)?.[optionKey] : null

        return (typeof gameId === 'string' && gameId)
            ? gameId
            : this.#getGameIdFromUrl(window.location.href)
    }

    #getGameIdFromUrl(url: string): string | null {
        try {
            const parsedUrl = new URL(url)
            const parts = parsedUrl.pathname.split('/').filter(Boolean)
            const { platformId } = this._platformBridge

            const urlPatternMap: Partial<Record<PlatformId, { pathKey: string }>> = {
                [PLATFORM_ID.YANDEX]: { pathKey: 'app' },
                [PLATFORM_ID.LAGGED]: { pathKey: 'g' },
                [PLATFORM_ID.CRAZY_GAMES]: { pathKey: 'game' },
            }

            const pattern = urlPatternMap[platformId]
            if (pattern) {
                const index = parts.indexOf(pattern.pathKey)
                const value = index !== -1 ? parts[index + 1] : null
                if (value) {
                    return value
                }
            }

            if (platformId === PLATFORM_ID.XIAOMI) {
                const lastPart = parts[parts.length - 1]
                if (lastPart === 'index.html' && parts.length >= 2) {
                    return parts[parts.length - 2]
                }
            }

            if (platformId === PLATFORM_ID.PLAYGAMA) {
                const gameIdParam = parsedUrl.searchParams.get('game_id')
                if (gameIdParam) {
                    return gameIdParam
                }

                const match = parsedUrl.hostname.match(/^([a-z0-9-]+)\.games\.playgama\.net$/i)
                if (match) {
                    return match[1]
                }
            }
        } catch {
            return null
        }

        return null
    }

    #startFlushInterval(): void {
        if (this.#flushTimer) {
            return
        }

        this.#flushTimer = setInterval(() => {
            this.send(`${MODULE_NAME.CORE}_ping`)
            this.#flush()
        }, FLUSH_INTERVAL)
    }
}

export default new AnalyticsModule()
