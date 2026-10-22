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

import { PLATFORM_ID, type PlatformId } from '../platform/constants'
import { ERROR_CODE, type ErrorCode } from '../../constants/errors'

// Message addressing: a player id (or a list of ids), the room host, all players
// or everyone except the sender.
export const MULTIPLAYER_TARGET = {
    ALL: 'all',
    OTHERS: 'others',
    HOST: 'host',
} as const
export type MultiplayerTarget = typeof MULTIPLAYER_TARGET[keyof typeof MULTIPLAYER_TARGET]

// Multiplayer kind, picked per room.
// RELAY: the host player runs the game, the server relays messages.
export const MULTIPLAYER_TYPE = {
    RELAY: 'relay',
} as const
export type MultiplayerType = typeof MULTIPLAYER_TYPE[keyof typeof MULTIPLAYER_TYPE]

export const MULTIPLAYER_STATE = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    // The connection dropped, the player keeps the seat while the SDK reconnects.
    RECONNECTING: 'reconnecting',
} as const
export type MultiplayerState = typeof MULTIPLAYER_STATE[keyof typeof MULTIPLAYER_STATE]

export const ROOM_LEAVE_REASON = {
    // leaveRoom() was called.
    LEFT: 'left',
    // The connection could not be restored while the server kept the seat.
    CONNECTION_LOST: 'connection_lost',
    // The server closed the room.
    ROOM_CLOSED: 'room_closed',
} as const
export type RoomLeaveReason = typeof ROOM_LEAVE_REASON[keyof typeof ROOM_LEAVE_REASON]

// Platforms whose sandbox blocks the connection to the multiplayer servers: any
// external call on YouTube, a direct WebSocket (without URL mapping) on Discord.
export const MULTIPLAYER_UNSUPPORTED_PLATFORMS: readonly PlatformId[] = [
    PLATFORM_ID.YOUTUBE,
    PLATFORM_ID.DISCORD,
]

export const MULTIPLAYER_DEFAULTS = {
    TYPE: MULTIPLAYER_TYPE.RELAY,
    MAX_PLAYERS: 4,
    ROOM_LIST_LIMIT: 50,
    // Storage namespace of the backend sessions when the config names none.
    ENVIRONMENT: 'production',
    // Time to learn the room host after entering: the server picks it from the
    // players whose SDK has registered for the host role.
    HOST_TIMEOUT: 5000,
} as const

export const MAX_PLAYER_NAME_LENGTH = 32

// The server assigns the host only among players that sync a world snapshot,
// so every player syncs an empty one: the host role is all the game needs.
export const HOST_SYNC = {
    UPDATES_PER_SECOND: 1,
} as const

// Backend error codes -> bridge errors.
export const BACKEND_ERRORS: Readonly<Record<string, ErrorCode>> = {
    ROOM_NOT_FOUND: ERROR_CODE.MULTIPLAYER_ROOM_NOT_FOUND,
    ROOM_FULL: ERROR_CODE.MULTIPLAYER_ROOM_FULL,
    JOIN_CLOSED: ERROR_CODE.MULTIPLAYER_ROOM_CLOSED,
    INVALID_REQUEST: ERROR_CODE.MULTIPLAYER_ROOM_NOT_FOUND,
}

// Transport errors after which the room is gone, not only the connection.
export const ROOM_ENDED_ERRORS: readonly string[] = ['ROOM_ENDED']

// Transport connection states.
export const CONNECTION_STATE = {
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    DISCONNECTED: 'disconnected',
} as const

// Invite code: 8 chars, the first one is the region of the room.
export const INVITE_CODE_PATTERN = /^[KRX][0123456789ABCDEFGHJKMNPQRSTVWXYZ]{7}$/
export const ROOM_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
