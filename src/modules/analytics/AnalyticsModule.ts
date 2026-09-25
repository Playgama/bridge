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

import { EVENT_NAME, MODULE_NAME } from '../../constants'
import { serverTimeCache } from '../../lib/serverTime'
import { PLATFORM_ID, PLATFORM_MESSAGE, type PlatformId } from '../platform/constants'
import packageJson from '../../../package.json'
import { generateRandomId } from '../../utils'
import { getGuestUser } from '../player'
import ModuleBase from '../ModuleBase'
import eventBus from '../../lib/EventBus'
import bridgeConfig from '../../lib/bridge-config'
import logger from '../../lib/logger'
import { getApiOrigin } from '../../lib/apiOrigin'
import GameplayMilestoneTracker from './GameplayMilestoneTracker'
import {
    ANALYTICS_PATH,
    FLUSH_INTERVAL,
    CUSTOM_EVENTS_QUEUE_LIMIT,
} from './constants'
import type {
    AnalyticsBridgeContract,
    AnalyticsSender,
    AnalyticsEvent,
    AnalyticsMeta,
    AnalyticsPayload,
} from './types'

export const internalAnalytics: AnalyticsSender = {
    send: () => {},
}

class AnalyticsModule extends ModuleBase<AnalyticsBridgeContract> {
    set gameVersion(value: string | null) {
        this.#gameVersion = value
    }

    #eventQueue: AnalyticsEvent[] = []

    #customEventQueue: AnalyticsEvent[] = []

    #flushTimer: ReturnType<typeof setInterval> | null = null

    #gameId: string | null = null

    #playerGuestId: string | null = null

    #gameVersion: string | null = null

    #sessionId: string

    #isDisabled = false

    #visibilityHandler: (() => void) | null = null

    #pagehideHandler: ((event: PageTransitionEvent) => void) | null = null

    #isSessionEndSent = false

    #timeDiff = 0

    #isCompressionSupported = typeof CompressionStream !== 'undefined'

    #gameplayMilestones = new GameplayMilestoneTracker(
        (eventName: string) => this.#sendInternal(eventName),
    )

    constructor() {
        super()
        this.#sessionId = this.#generateSessionId()

        internalAnalytics.send = (eventName: string, data: Record<string, unknown> = {}): void => {
            this.#sendInternal(eventName, data)
        }
    }

    initialize(platformBridge: AnalyticsBridgeContract): this {
        super.initialize(platformBridge)

        const isPlaygama = this._platformBridge.platformId === PLATFORM_ID.PLAYGAMA
        if (!isPlaygama && bridgeConfig.getValues().sendAnalyticsEvents === false) {
            this.#isDisabled = true
        }

        const { href } = window.location
        if (href.startsWith('file://') || href.includes('localhost') || href.includes('127.0.0.1')) {
            this.#isDisabled = true
        }

        if (!this._platformBridge.isPlatformExternalCallsSupported) {
            this.#isDisabled = true
        }

        this.#gameId = this.#extractGameId()
        this.#playerGuestId = getGuestUser().id

        if (this.#isDisabled) {
            return this
        }

        this.#fetchTimeDiff()
        this.#sendInternal(`${MODULE_NAME.CORE}_initialization_started`)
        this.#startFlushInterval()
        this.#setupPageUnloadHandler()
        this.#setupGameplayMilestones()

        return this
    }

    send(eventName: string, data: Record<string, unknown> = {}): void {
        if (this.#isDisabled) {
            return
        }

        if (typeof eventName !== 'string' || eventName.length === 0) {
            logger.warn('Analytics event name must be a non-empty string', eventName)
            return
        }

        this.#customEventQueue.push(this.#createEvent(eventName, data))

        if (this.#customEventQueue.length > CUSTOM_EVENTS_QUEUE_LIMIT) {
            this.#customEventQueue.splice(0, this.#customEventQueue.length - CUSTOM_EVENTS_QUEUE_LIMIT)
        }
    }

    #sendInternal(eventName: string, data: Record<string, unknown> = {}): void {
        if (this.#isDisabled) {
            return
        }

        this.#eventQueue.push(this.#createEvent(eventName, data))
    }

    #generateSessionId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }

        return generateRandomId()
    }

    async #fetchTimeDiff(): Promise<void> {
        try {
            const serverTime = await serverTimeCache.getServerTime()
            this.#timeDiff = serverTime - Date.now()

            this.#applyTimeDiff(this.#eventQueue)
            this.#applyTimeDiff(this.#customEventQueue)
        } catch {
            // Keep timeDiff = 0, use local time as fallback
        }
    }

    #applyTimeDiff(events: AnalyticsEvent[]): void {
        for (let i = 0; i < events.length; i++) {
            const event = events[i]
            const localTime = new Date(event.timestamp).getTime()
            event.timestamp = new Date(localTime + this.#timeDiff).toISOString()
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
        const meta: AnalyticsMeta = {
            bridge_version: packageJson.version,
            platform_id: this._platformBridge.platformId,
            game_id: this.#gameId,
            game_version: this.#gameVersion,
            session_id: this.#sessionId,
            player_id: this._platformBridge.playerId,
            player_guest_id: this.#playerGuestId,
            device_type: this._platformBridge.deviceType,
            device_os: this._platformBridge.deviceOs,
            clid: this._platformBridge.data?.clid ?? '',
            launch_source: this._platformBridge.launchSource,
        }

        const publicToken = bridgeConfig.getValues().saas?.publicToken
        if (publicToken) {
            meta.public_token = publicToken
        }

        return meta
    }

    async #compressData(data: AnalyticsPayload): Promise<Blob> {
        const json = JSON.stringify(data)
        const stream = new Blob([json]).stream()
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
        return new Response(compressedStream).blob()
    }

    #getApiUrl(): string {
        return `${getApiOrigin()}${ANALYTICS_PATH}`
    }

    #createPayload(events: AnalyticsEvent[], customEvents: AnalyticsEvent[]): AnalyticsPayload {
        const payload: AnalyticsPayload = {
            meta: this.#createMeta(),
            events,
        }

        if (customEvents.length > 0) {
            payload.custom_events = customEvents
        }

        return payload
    }

    async #flush(): Promise<void> {
        if (this.#isDisabled || (this.#eventQueue.length === 0 && this.#customEventQueue.length === 0)) {
            return
        }

        const events = [...this.#eventQueue]
        const customEvents = [...this.#customEventQueue]
        this.#eventQueue = []
        this.#customEventQueue = []

        const success = await this.#sendRequest(this.#createPayload(events, customEvents))
        if (!success && !this.#isDisabled) {
            this.#eventQueue = [...events, ...this.#eventQueue]
            this.#customEventQueue = [...customEvents, ...this.#customEventQueue].slice(-CUSTOM_EVENTS_QUEUE_LIMIT)
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
                keepalive: true,
            })

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`)
            }

            return true
        } catch {
            return false
        }
    }

    #flushSync(): void {
        if (this.#isDisabled || (this.#eventQueue.length === 0 && this.#customEventQueue.length === 0)) {
            return
        }

        const events = [...this.#eventQueue]
        const customEvents = [...this.#customEventQueue]
        this.#eventQueue = []
        this.#customEventQueue = []

        const url = this.#getApiUrl()
        const payload = this.#createPayload(events, customEvents)
        const body = JSON.stringify(payload)

        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' })
            navigator.sendBeacon(url, blob)
        }
    }

    #setupPageUnloadHandler(): void {
        this.#pagehideHandler = (event: PageTransitionEvent) => {
            this.#sendSessionEnd()

            if (event.persisted) {
                this.#resumeSession()
            }
        }

        this.#visibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                this.#stopFlushInterval()
                this.#sendSessionEnd()
            } else {
                this.#resumeSession()
            }
        }

        document.addEventListener('visibilitychange', this.#visibilityHandler)
        window.addEventListener('pagehide', this.#pagehideHandler)
    }

    #resumeSession(): void {
        if (this.#isDisabled) {
            return
        }

        this.#isSessionEndSent = false
        this.#startFlushInterval()
    }

    #sendSessionEnd(): void {
        if (this.#isSessionEndSent || this.#isDisabled) {
            return
        }

        this.#isSessionEndSent = true
        this.#sendInternal(`${MODULE_NAME.CORE}_session_end`)
        this.#flushSync()
    }

    #extractGameId(): string | null {
        const { platformId } = this._platformBridge
        const options = bridgeConfig.getValues()

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

            if (
                platformId === PLATFORM_ID.PLAYGAMA
                || platformId === PLATFORM_ID.STANDALONE
                || platformId === PLATFORM_ID.PLAYGAMA_SANDBOX
            ) {
                const gameIdParam = parsedUrl.searchParams.get('game_id')
                if (gameIdParam) {
                    return gameIdParam
                }

                const match = parsedUrl.hostname.match(/^([a-z0-9-]+)\.games\.playgama\.net$/i)
                if (match) {
                    return match[1].replace(/^sb-/i, '')
                }
            }
        } catch {
            return null
        }

        return null
    }

    // Counts from the moment the game reports it is ready and reports how long the player stays
    #setupGameplayMilestones(): void {
        this.#gameplayMilestones.setPauseState(this._platformBridge.isPlatformPaused)

        this._platformBridge.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: unknown) => {
            this.#gameplayMilestones.setPauseState(isPaused === true)
        })

        eventBus.on(EVENT_NAME.PLATFORM_MESSAGE_SENT, (message: unknown) => {
            if (message === PLATFORM_MESSAGE.GAME_READY) {
                this.#gameplayMilestones.start()
            }
        })
    }

    #startFlushInterval(): void {
        if (this.#flushTimer) {
            return
        }

        this.#flushTimer = setInterval(() => {
            this.#sendInternal(`${MODULE_NAME.CORE}_ping`)
            this.#flush()
        }, FLUSH_INTERVAL)
    }

    #stopFlushInterval(): void {
        if (this.#flushTimer) {
            clearInterval(this.#flushTimer)
            this.#flushTimer = null
        }
    }
}

const analyticsModule = new AnalyticsModule()
export default analyticsModule
