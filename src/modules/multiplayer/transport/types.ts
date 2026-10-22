import type { JsonValue, JsonObject } from '../../../utils/json'
import type { RoomMetadata } from './protocol'

export type MultiplayerRegion = 'eu' | 'us' | 'ap'
export type MultiplayerJson = JsonValue
export type MultiplayerProperties = JsonObject
export type MultiplayerFilter = Record<string, string | boolean | number>
export type MultiplayerRecipient = 'others' | string | string[]
export type MultiplayerConnectionState = 'connected' | 'reconnecting' | 'disconnected'

/** Explicit opt-in. apiBase is the facade root ending in /api/bridge/v1/relay. */
export interface MultiplayerConfig {
    apiBase: string
    appToken: string
    environment: string
    region?: MultiplayerRegion
}

export interface MultiplayerPlayer {
    id: string
    name: string
    properties: MultiplayerProperties
}

export interface MultiplayerPlayerInput {
    name: string
    properties?: MultiplayerProperties
}

export interface MultiplayerCreateOptions {
    player: MultiplayerPlayerInput
    gameVersion?: string
    maxPlayers?: number
    isOpen?: boolean
    isVisible?: boolean
    filter?: MultiplayerFilter
    properties?: MultiplayerProperties
}

export type MultiplayerJoinOptions = {
    player: MultiplayerPlayerInput
    gameVersion?: string
} & ({ code: string; roomId?: never } | { roomId: string; code?: never })

export type MultiplayerMatchOptions = Omit<MultiplayerCreateOptions, 'isOpen' | 'isVisible'>

export interface MultiplayerRoomsQuery {
    gameVersion?: string
    maxPlayers?: number
    filter?: MultiplayerFilter
    limit?: number
    cursor?: string
}

export interface MultiplayerRoomSummary {
    id: string
    region: MultiplayerRegion
    gameVersion: string
    maxPlayers: number
    isOpen: boolean
    playerCount: number
    occupiedSeats: number
    filter: MultiplayerFilter
    properties: MultiplayerProperties
}

export interface MultiplayerRoomPatch {
    isOpen?: boolean
    isVisible?: boolean
    properties?: MultiplayerProperties
}

export interface MultiplayerState {
    connectionState: MultiplayerConnectionState
    syncState: 'syncing' | 'ready' | 'error'
    isHost: boolean
    isReady: boolean
}

export interface MultiplayerMessage {
    type: string
    from: string
    data: MultiplayerJson
}

export interface MultiplayerBytesMessage {
    type: string
    from: string
    data: Uint8Array
}

export interface MultiplayerSyncOptions<T extends object> {
    getState: () => T
    applyState: (state: T) => void
    updatesPerSecond?: number
}

export class MultiplayerError extends Error {
    readonly code: string

    readonly retryAfterMs?: number

    constructor(code: string, message?: string, retryAfterMs?: number) {
        super(message || code)
        this.name = 'MultiplayerError'
        this.code = code
        this.retryAfterMs = retryAfterMs
    }
}

export type MultiplayerUnsubscribe = () => void

/** A stable handle; subscriptions survive transport replacement. */
export interface MultiplayerRoom {
    readonly id: string
    readonly playerId: string
    readonly inviteCode: string
    readonly players: MultiplayerPlayer[]
    readonly hostPlayerId: string | null
    readonly info: RoomMetadata
    readonly properties: MultiplayerProperties
    readonly connectionState: MultiplayerConnectionState
    readonly isHost: boolean
    readonly isReady: boolean
    syncState<T extends object>(options: MultiplayerSyncOptions<T>): void
    send(type: string, data: MultiplayerJson, to?: MultiplayerRecipient): void
    sendBytes(type: string, data: Uint8Array, to?: MultiplayerRecipient): void
    onMessage(callback: (message: MultiplayerMessage) => void): MultiplayerUnsubscribe
    onMessageBytes(callback: (message: MultiplayerBytesMessage) => void): MultiplayerUnsubscribe
    onPlayersChange(callback: (players: MultiplayerPlayer[]) => void): MultiplayerUnsubscribe
    onStateChange(callback: (state: MultiplayerState) => void): MultiplayerUnsubscribe
    onRoomChange(callback: (room: MultiplayerRoom) => void): MultiplayerUnsubscribe
    onError(callback: (error: MultiplayerError) => void): MultiplayerUnsubscribe
    setRoom(patch: MultiplayerRoomPatch): Promise<void>
    setPlayer(properties: MultiplayerProperties): Promise<void>
    leave(): Promise<void>
}
