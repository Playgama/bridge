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

import type { PlatformBridgeLike } from '../ModuleBase'
import type { PlatformId } from '../platform/constants'
import type { DeviceOs, DeviceType } from '../device/constants'
import type { LaunchSource } from '../../constants'
import type { GAME_ERROR_TYPE } from './constants'

export interface AnalyticsBridgeOptions {
    sendAnalyticsEvents?: boolean
    saas?: { publicToken?: string } & Record<string, unknown>
    [key: string]: unknown
}

export interface AnalyticsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    playerId: string | null
    deviceType: DeviceType
    deviceOs: DeviceOs
    options: AnalyticsBridgeOptions
    launchSource: LaunchSource | null
    publishState?: string | null
    isPlatformExternalCallsSupported: boolean
    isPlatformPaused: boolean
    data?: { clid?: string } & Record<string, unknown>
    sendAnalyticsEvent?(eventName: string, data: Record<string, unknown>): void
}

export interface AnalyticsSender {
    send(eventType: string, data?: Record<string, unknown>): void
}

export interface InternalAnalytics extends AnalyticsSender {
    // Sends the queued events right away with a beacon, e.g. while the page is closing.
    flush(): void
}

export interface AnalyticsEvent {
    event_name: string
    timestamp: string
    data: Record<string, unknown>
}

export interface AnalyticsMeta {
    bridge_version: string
    platform_id: PlatformId
    game_id: string | null
    game_version: string | null
    session_id: string
    player_id: string | null
    player_guest_id: string | null
    device_type: DeviceType
    device_os: DeviceOs
    clid: string
    launch_source: LaunchSource | null
    publish_state?: string
    public_token?: string
}

export interface AnalyticsPayload {
    meta: AnalyticsMeta
    events: AnalyticsEvent[]
    custom_events?: AnalyticsEvent[]
    errors?: AnalyticsErrorEvent[]
}

export type GameErrorType = typeof GAME_ERROR_TYPE[keyof typeof GAME_ERROR_TYPE]

export interface GameError {
    type: GameErrorType
    message: string
    stack: string
    source: string
    line: number
    col: number
    fingerprint: string
}

export interface CapturedGameError extends GameError {
    // Local time in milliseconds of the first occurrence among the counted ones
    timestamp: number
    count: number
}

export interface AnalyticsErrorEvent extends GameError {
    timestamp: string
    count: number
}
