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

import { internalAnalytics } from '../analytics'
import type { BridgeError } from '../../constants/errors'
import type { MultiplayerRoom as RoomHandle } from './transport/types'
import {
    MULTIPLAYER_ANALYTICS_EVENT,
    PAGE_CLOSED_LEAVE_REASON,
    RECONNECT_FAILED_ERROR,
    ROOM_ENTER_METHOD,
    type RoomEnterMethod,
    type RoomLeaveReason,
} from './constants'

interface RoomStats {
    roomId: string
    isHost: boolean
    maxPlayersCount: number
    peakPlayersCount: number
    hostChanges: number
    messagesSent: number
    messagesReceived: number
}

// Room entry results and per-room stats for the internal analytics.
class MultiplayerAnalytics {
    #room: RoomStats | null = null

    #isPageListenerAdded = false

    enterCompleted(method: RoomEnterMethod, handle: RoomHandle): void {
        this.#room = {
            roomId: handle.id,
            isHost: handle.isHost,
            maxPlayersCount: handle.info.maxPlayers,
            peakPlayersCount: handle.players.length,
            hostChanges: 0,
            messagesSent: 0,
            messagesReceived: 0,
        }
        this.#addPageListener()
        this.#sendEnterCompleted(method)
    }

    enterFailed(method: RoomEnterMethod, error: BridgeError): void {
        internalAnalytics.send(MULTIPLAYER_ANALYTICS_EVENT.ROOM_ENTER_FAILED, {
            method,
            error: error.code,
        })
    }

    reconnectCompleted(handle: RoomHandle): void {
        if (this.#room) {
            this.#room.peakPlayersCount = Math.max(this.#room.peakPlayersCount, handle.players.length)
            this.#sendEnterCompleted(ROOM_ENTER_METHOD.RECONNECT)
        }
    }

    // error: the transport error that closed the room, if any.
    reconnectFailed(error: string | null): void {
        if (this.#room) {
            internalAnalytics.send(MULTIPLAYER_ANALYTICS_EVENT.ROOM_ENTER_FAILED, {
                method: ROOM_ENTER_METHOD.RECONNECT,
                error: error ?? RECONNECT_FAILED_ERROR,
            })
        }
    }

    roomLeft(reason: RoomLeaveReason | typeof PAGE_CLOSED_LEAVE_REASON): void {
        const room = this.#room
        if (!room) {
            return
        }

        internalAnalytics.send(MULTIPLAYER_ANALYTICS_EVENT.ROOM_LEFT, {
            reason,
            room_id: room.roomId,
            messages_sent: room.messagesSent,
            messages_received: room.messagesReceived,
            max_players_count: room.maxPlayersCount,
            peak_players_count: room.peakPlayersCount,
            is_host: room.isHost,
            host_changes: room.hostChanges,
        })
        this.#room = null
    }

    playersChanged(count: number): void {
        if (this.#room) {
            this.#room.peakPlayersCount = Math.max(this.#room.peakPlayersCount, count)
        }
    }

    hostChanged(): void {
        if (this.#room) {
            this.#room.hostChanges += 1
        }
    }

    hostRoleChanged(isHost: boolean): void {
        if (this.#room) {
            this.#room.isHost = isHost
        }
    }

    messageSent(): void {
        if (this.#room) {
            this.#room.messagesSent += 1
        }
    }

    messageReceived(): void {
        if (this.#room) {
            this.#room.messagesReceived += 1
        }
    }

    #sendEnterCompleted(method: RoomEnterMethod): void {
        const room = this.#room
        if (!room) {
            return
        }

        internalAnalytics.send(MULTIPLAYER_ANALYTICS_EVENT.ROOM_ENTER_COMPLETED, {
            method,
            room_id: room.roomId,
            is_host: room.isHost,
            max_players_count: room.maxPlayersCount,
        })
    }

    // Players usually close the page without leaving the room. By pagehide the analytics
    // module has already flushed its queue, so the leave is flushed here.
    #addPageListener(): void {
        if (this.#isPageListenerAdded) {
            return
        }

        this.#isPageListenerAdded = true
        window.addEventListener('pagehide', () => {
            if (this.#room) {
                this.roomLeft(PAGE_CLOSED_LEAVE_REASON)
                internalAnalytics.flush()
            }
        })
    }
}

export default MultiplayerAnalytics
