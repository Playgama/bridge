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

import type { AnyRecord } from '../../utils'
import type { MultiplayerTarget, MultiplayerType } from './constants'

export interface MultiplayerConfig {
    // Multiplayer API root, e.g. https://staging.playgama.com/api/bridge/v1/relay.
    // Multiplayer is not supported without it and without saas.publicToken.
    apiBase?: string
    // Keeps backend sessions of different environments apart.
    environment?: string
    maxPlayers?: number
}

// JSON-serializable custom data. On update keys are merged, a null value removes the key.
export type MultiplayerProperties = Record<string, unknown>

export interface MultiplayerPlayer {
    id: string
    name: string
    isHost: boolean
    // Players are listed while connected only.
    isConnected: boolean
    properties: MultiplayerProperties
}

export interface MultiplayerRoom {
    // Invite code players type to join.
    id: string
    type: MultiplayerType
    maxPlayers: number
    // Accepts new players.
    isOpen: boolean
    // Listed by getRooms() and matched by joinOrCreateRoom().
    isVisible: boolean
    hostId: string
    properties: MultiplayerProperties
}

// Room list entry: open public rooms with a free seat.
export interface MultiplayerRoomInfo {
    // Passed to joinRoom().
    id: string
    type: MultiplayerType
    maxPlayers: number
    playerCount: number
    properties: MultiplayerProperties
}

export interface MultiplayerMessage {
    type: string
    data: unknown
    from: string
}

export interface MultiplayerSendOptions {
    // Player id, list of player ids or MULTIPLAYER_TARGET (OTHERS by default).
    to?: MultiplayerTarget | string | string[]
}

export interface PlayerOptions {
    playerName?: string
    playerProperties?: MultiplayerProperties
}

// MULTIPLAYER_TYPE.RELAY by default.
export interface RoomTypeOptions {
    type?: MultiplayerType
}

export interface CreateRoomOptions extends PlayerOptions, RoomTypeOptions {
    maxPlayers?: number
    // Listed and matched to other players. False by default: the room is joined by code.
    isVisible?: boolean
    isOpen?: boolean
    properties?: MultiplayerProperties
}

export interface JoinRoomOptions extends PlayerOptions, RoomTypeOptions {}

export interface JoinOrCreateRoomOptions extends PlayerOptions, RoomTypeOptions {
    // Players are matched only into rooms of the same size.
    maxPlayers?: number
    // Room properties the room must have (equal values), e.g. { mode: 'duel' };
    // a created room gets them too.
    filter?: MultiplayerProperties
    // Extra properties of a created room.
    properties?: MultiplayerProperties
}

export interface GetRoomsOptions extends RoomTypeOptions {
    filter?: MultiplayerProperties
    maxPlayers?: number
    limit?: number
}

// Content the game adds to a room invite; any other key is passed to the platform as is.
export interface RoomInviteOptions extends AnyRecord {
    text?: string
    image?: string
}

// Room invite the platform turns into a link that opens the game, see multiplayer.launchRoomId.
export interface MultiplayerRoomInvite extends RoomInviteOptions {
    roomId: string
    type: MultiplayerType
}

// The room the player is in, reported to the platform on every change (null after leaving),
// so the platform can offer its own room invite outside of the game.
export interface MultiplayerRoomStatus {
    id: string
    type: MultiplayerType
    maxPlayers: number
    playerCount: number
    isOpen: boolean
    isVisible: boolean
}
