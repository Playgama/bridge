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

export interface AnalyticsSender {
    send(eventType: string, data?: Record<string, unknown>): void
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
    session_id: string
    player_id: string | null
    player_guest_id: string | null
    device_type: DeviceType
    device_os: DeviceOs
    clid: string
}

export interface AnalyticsPayload {
    meta: AnalyticsMeta
    events: AnalyticsEvent[]
}
