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

import ModuleBase, { type PlatformBridgeLike } from '../ModuleBase'
import type { PlatformId } from '../platform/constants'
import { EVENT_NAME } from '../../constants'
import { BridgeError, ERROR_CODE } from '../../constants/errors'
import eventBus, { applyEventBusMixin, type EventEmitter } from '../../lib/EventBus'
import bridgeConfig from '../../lib/bridge-config'
import logger from '../../lib/logger'
import type { JsonObject, JsonValue } from '../../utils/json'
import type MultiplayerRuntime from './transport/Runtime'
import { MultiplayerError } from './transport/types'
import type {
    MultiplayerRoom as RoomHandle,
    MultiplayerPlayer as RoomMember,
    MultiplayerState as ConnectionStatus,
} from './transport/types'
import {
    BACKEND_ERRORS,
    CONNECTION_STATE,
    HOST_SYNC,
    INVITE_CODE_PATTERN,
    MAX_PLAYER_NAME_LENGTH,
    MULTIPLAYER_DEFAULTS,
    MULTIPLAYER_STATE,
    MULTIPLAYER_TARGET,
    MULTIPLAYER_TYPE,
    MULTIPLAYER_UNSUPPORTED_PLATFORMS,
    RATE_LIMITED_ERROR,
    ROOM_ENDED_ERRORS,
    ROOM_LEAVE_REASON,
    ROOM_UUID_PATTERN,
    type MultiplayerState,
    type RoomLeaveReason,
} from './constants'
import type {
    CreateRoomOptions,
    GetRoomsOptions,
    JoinOrCreateRoomOptions,
    JoinRoomOptions,
    MultiplayerConfig,
    MultiplayerPlayer,
    MultiplayerProperties,
    MultiplayerRoom,
    MultiplayerRoomInfo,
    MultiplayerRoomInvite,
    MultiplayerRoomStatus,
    MultiplayerSendOptions,
    MultiplayerSyncOptions,
    MultiplayerSyncStateOption,
    PlayerOptions,
    RoomInviteOptions,
} from './types'

export interface MultiplayerBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    playerId: string | null
    playerName: string | null
    isMultiplayerRoomInviteSupported: boolean
    multiplayerLaunchRoomId: string | null
    multiplayerInviteToRoom(invite: MultiplayerRoomInvite): Promise<unknown>
    notifyMultiplayerRoomChanged(room: MultiplayerRoomStatus | null): void
}

interface OutgoingMessage {
    type: string
    data: JsonValue
    to: string | string[]
}

function isEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

interface MultiplayerModule extends EventEmitter {}

// Room-based multiplayer on the Playgama multiplayer backend: an HTTP API reserves
// a seat, then the player connects to the room server over WebSocket. RELAY rooms:
// one player hosts the room and runs the game logic, the server relays messages
// and hands the host role to another player when the host leaves or drops.
// The transport (sessions, retries, reconnects, epochs) lives in ./transport and is
// loaded on the first room call.
class MultiplayerModule extends ModuleBase<MultiplayerBridgeContract> {
    get isSupported(): boolean {
        return Boolean(this.#getPublicToken())
            && typeof WebSocket !== 'undefined'
            && !MULTIPLAYER_UNSUPPORTED_PLATFORMS.includes(this._platformBridge.platformId)
    }

    get state(): MultiplayerState {
        return this.#state
    }

    get isInRoom(): boolean {
        return this.#state === MULTIPLAYER_STATE.CONNECTED || this.#state === MULTIPLAYER_STATE.RECONNECTING
    }

    // True once the server has made this player the host and the role is active.
    get isHost(): boolean {
        return this.#handle?.isHost ?? false
    }

    get playerId(): string | null {
        return this.#handle?.playerId || null
    }

    get hostId(): string | null {
        return this.#hostId
    }

    // Invite code: other players join the room with it.
    get roomId(): string | null {
        return this.#handle?.inviteCode || null
    }

    get room(): MultiplayerRoom | null {
        const handle = this.#handle
        if (!handle) {
            return null
        }

        const { info } = handle
        return {
            id: handle.inviteCode,
            type: MULTIPLAYER_TYPE.RELAY,
            maxPlayers: info.maxPlayers,
            isOpen: info.isOpen,
            isVisible: info.isVisible,
            hostId: this.#hostId ?? '',
            properties: { ...info.properties },
        }
    }

    // Connected players.
    get players(): MultiplayerPlayer[] {
        return this.#players.map((player) => this.#toPlayer(player))
    }

    // The platform can share a link to the current room, see inviteToRoom().
    get isInviteSupported(): boolean {
        return this.isSupported && this._platformBridge.isMultiplayerRoomInviteSupported
    }

    // Room code from the invite link the game was opened with: pass it to joinRoom().
    // Null when there is none or once the player has entered any room.
    get launchRoomId(): string | null {
        if (this.#isLaunchRoomUsed) {
            return null
        }

        const roomId = this._platformBridge.multiplayerLaunchRoomId
        return roomId ? String(roomId).trim().toUpperCase() : null
    }

    // World of syncState without callbacks: the last one set with setSyncState() or received.
    get syncState(): MultiplayerProperties {
        return { ...this.#syncState }
    }

    #state: MultiplayerState = MULTIPLAYER_STATE.DISCONNECTED

    #runtime: Promise<MultiplayerRuntime> | null = null

    #handle: RoomHandle | null = null

    #players: RoomMember[] = []

    #hostId: string | null = null

    // Last reported isHost: the local host role becomes active after the host id is assigned.
    #isHost = false

    #roomSnapshot: unknown = null

    #unsubscribers: Array<() => void> = []

    #closeReason: RoomLeaveReason | null = null

    #outgoing: OutgoingMessage[] = []

    #sendTimer: ReturnType<typeof setTimeout> | undefined

    // The backend confirms a leave over HTTP; entering a room waits for it.
    #leaving: Promise<void> = Promise.resolve()

    #isLaunchRoomUsed = false

    #syncState: JsonObject = {}

    // Resolves with the invite code. A hidden room (the default) is for friends:
    // only players the code was shared with can join.
    async createRoom<T extends object = object>(options: CreateRoomOptions<T> = {}): Promise<string> {
        await this.#enterRoom((runtime) => runtime.createRoom({
            player: this.#getPlayer(options),
            maxPlayers: this.#getMaxPlayers(options.maxPlayers),
            isOpen: options.isOpen ?? true,
            isVisible: options.isVisible ?? false,
            filter: options.filter ?? {},
            properties: this.#getRoomProperties(options),
        }), options.syncState)
        return this.roomId ?? ''
    }

    // By the invite code, or by the id of a room from getRooms().
    async joinRoom<T extends object = object>(roomId: string, options: JoinRoomOptions<T> = {}): Promise<void> {
        const id = String(roomId).trim()
        const code = id.toUpperCase()
        const player = this.#getPlayer(options)

        if (INVITE_CODE_PATTERN.test(code)) {
            await this.#enterRoom((runtime) => runtime.joinRoom({ code, player }), options.syncState)
        } else if (ROOM_UUID_PATTERN.test(id)) {
            await this.#enterRoom((runtime) => runtime.joinRoom({
                roomId: id.toLowerCase(), player,
            }), options.syncState)
        } else {
            throw new BridgeError(ERROR_CODE.MULTIPLAYER_ROOM_NOT_FOUND)
        }
    }

    // Quick match: enters an open public room of the same size and filter, the
    // fullest first, or creates one. Resolves with the invite code.
    async joinOrCreateRoom<T extends object = object>(options: JoinOrCreateRoomOptions<T> = {}): Promise<string> {
        await this.#enterRoom((runtime) => runtime.joinOrCreateRoom({
            player: this.#getPlayer(options),
            maxPlayers: this.#getMaxPlayers(options.maxPlayers),
            filter: options.filter ?? {},
            properties: this.#getRoomProperties(options),
        }), options.syncState)
        return this.roomId ?? ''
    }

    // Open public rooms with a free seat, for a room browser.
    async getRooms(options: GetRoomsOptions = {}): Promise<MultiplayerRoomInfo[]> {
        if (!this.isSupported) {
            throw new BridgeError(ERROR_CODE.MULTIPLAYER_NOT_SUPPORTED)
        }

        try {
            const runtime = await this.#loadRuntime()
            const { rooms } = await runtime.getRooms({
                maxPlayers: options.maxPlayers,
                filter: options.filter,
                limit: options.limit ?? MULTIPLAYER_DEFAULTS.ROOM_LIST_LIMIT,
            })
            return rooms
                .filter((room) => room.isOpen && room.occupiedSeats < room.maxPlayers)
                .map((room) => ({
                    id: room.id,
                    type: MULTIPLAYER_TYPE.RELAY,
                    maxPlayers: room.maxPlayers,
                    playerCount: room.playerCount,
                    filter: room.filter,
                    properties: room.properties,
                }))
        } catch (error) {
            throw this.#toBridgeError(error)
        }
    }

    // Asks the platform to share a link to the current room: whoever opens it
    // starts the game with the room code in launchRoomId.
    inviteToRoom(options: RoomInviteOptions = {}): Promise<unknown> {
        if (!this.isInviteSupported) {
            return Promise.reject(new BridgeError(ERROR_CODE.MULTIPLAYER_NOT_SUPPORTED))
        }

        const { room } = this
        if (!room) {
            return Promise.reject(new BridgeError(ERROR_CODE.MULTIPLAYER_NOT_IN_ROOM))
        }

        return this._platformBridge.multiplayerInviteToRoom({ ...options, roomId: room.id, type: room.type })
    }

    leaveRoom(): void {
        const handle = this.#handle
        if (!handle) {
            return
        }

        this.#detach(ROOM_LEAVE_REASON.LEFT)
        this.#leaving = handle.leave().catch(() => {})
    }

    // Room creator only: stop (or resume) accepting new players, e.g. once the match starts.
    setRoomOpen(isOpen: boolean): void {
        this.#updateRoom({ isOpen })
    }

    // Room creator only: show (or hide) the room in the room list and matchmaking.
    setRoomVisible(isVisible: boolean): void {
        this.#updateRoom({ isVisible })
    }

    // Room creator only: keys are merged, a null value removes the key.
    setRoomProperties(properties: MultiplayerProperties): void {
        this.#updateRoom({ properties: properties as JsonObject })
    }

    // Updates the local player; keys are merged, a null value removes the key.
    setPlayerProperties(properties: MultiplayerProperties): void {
        if (!this.#handle) {
            logger.warn('[multiplayer] setPlayerProperties() called outside of a room')
            return
        }

        this.#handle.setPlayer(properties as JsonObject).catch((error) => {
            logger.warn('[multiplayer] Player properties were not changed:', error)
        })
    }

    // Messages over the send rate wait in order; one sent while the connection is down is lost.
    send(type: string, data?: unknown, options: MultiplayerSendOptions = {}): void {
        const handle = this.#handle
        if (!handle || this.#state !== MULTIPLAYER_STATE.CONNECTED) {
            logger.warn('[multiplayer] send() called while not connected to a room')
            return
        }

        // Data goes as JSON.stringify sees it: e.g. undefined fields are dropped, not refused
        let payload: JsonValue
        try {
            payload = JSON.parse(JSON.stringify(data ?? null))
        } catch (error) {
            logger.warn('[multiplayer] Message was not sent: data is not JSON', error)
            return
        }

        const self = handle.playerId
        const to = options.to ?? MULTIPLAYER_TARGET.OTHERS
        let remote: string | string[] | null = to
        let isForSelf = false

        if (to === MULTIPLAYER_TARGET.ALL) {
            remote = MULTIPLAYER_TARGET.OTHERS
            isForSelf = true
        } else if (to === MULTIPLAYER_TARGET.HOST) {
            isForSelf = this.#hostId === self
            remote = isForSelf ? null : this.#hostId
        } else if (Array.isArray(to)) {
            isForSelf = to.includes(self)
            const ids = to.filter((id) => id !== self)
            remote = ids.length > 0 ? ids : null
        } else if (to === self) {
            isForSelf = true
            remote = null
        }

        if (remote !== null) {
            this.#queueMessage({ type, data: payload, to: remote })
        }

        if (isForSelf) {
            // Own copy: a listener may change it while the remote copy still waits in the queue.
            const message = { type, data: JSON.parse(JSON.stringify(payload)), from: self }
            // Deliver asynchronously so a send to self behaves like a remote send.
            queueMicrotask(() => eventBus.emit(EVENT_NAME.MULTIPLAYER_MESSAGE_RECEIVED, message))
        }
    }

    // World for syncState without callbacks: the host sends the latest one. Works outside
    // a room too, e.g. to set the starting world before createRoom().
    setSyncState(state: MultiplayerProperties): void {
        let world: unknown
        try {
            world = JSON.parse(JSON.stringify(state ?? {}))
        } catch (error) {
            logger.warn('[multiplayer] Sync state was not set: state is not JSON', error)
            return
        }

        if (!world || typeof world !== 'object' || Array.isArray(world)) {
            logger.warn('[multiplayer] Sync state was not set: state is not an object')
            return
        }

        this.#syncState = world as JsonObject
    }

    // Callbacks as given, the stored world for true or { updatesPerSecond }, or an empty
    // world without syncState: the server picks the host only among synced players.
    #getSyncOptions<T extends object>(syncState?: MultiplayerSyncStateOption<T>): MultiplayerSyncOptions<T> {
        if (!syncState) {
            return {
                getState: () => ({}) as T,
                applyState: () => {},
                updatesPerSecond: HOST_SYNC.UPDATES_PER_SECOND,
            }
        }

        if (typeof syncState === 'object' && 'getState' in syncState) {
            return syncState
        }

        return {
            getState: () => this.#syncState as T,
            applyState: (state) => {
                this.#syncState = state as JsonObject
                eventBus.emit(EVENT_NAME.MULTIPLAYER_SYNC_STATE_RECEIVED, { ...this.#syncState })
            },
            updatesPerSecond: syncState === true ? undefined : syncState.updatesPerSecond,
        }
    }

    async #enterRoom<T extends object>(
        enter: (runtime: MultiplayerRuntime) => Promise<RoomHandle>,
        syncState?: MultiplayerSyncStateOption<T>,
    ): Promise<void> {
        if (!this.isSupported) {
            throw new BridgeError(ERROR_CODE.MULTIPLAYER_NOT_SUPPORTED)
        }

        if (this.#state !== MULTIPLAYER_STATE.DISCONNECTED) {
            throw new BridgeError(ERROR_CODE.MULTIPLAYER_ALREADY_IN_ROOM)
        }

        this.#setState(MULTIPLAYER_STATE.CONNECTING)
        let handle: RoomHandle | null = null

        try {
            await this.#leaving
            const runtime = await this.#loadRuntime()
            handle = await enter(runtime)
            handle.syncState(this.#getSyncOptions(syncState))
            await this.#waitForHost(handle)
        } catch (error) {
            handle?.leave().catch(() => {})
            this.#setState(MULTIPLAYER_STATE.DISCONNECTED)
            throw this.#toBridgeError(error)
        }

        this.#attach(handle)
    }

    // Resolves once the host role is settled for this player, or after HOST_TIMEOUT
    // when the room has no host to answer yet.
    #waitForHost(handle: RoomHandle): Promise<void> {
        return new Promise((resolve, reject) => {
            let isDone = false
            let unsubscribe: (() => void) | null = null
            const finish = (error?: BridgeError): void => {
                if (isDone) {
                    return
                }
                isDone = true
                clearTimeout(timer)
                unsubscribe?.()
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            }
            const timer = setTimeout(() => finish(), MULTIPLAYER_DEFAULTS.HOST_TIMEOUT)

            unsubscribe = handle.onStateChange((state) => {
                if (state.isReady) {
                    finish()
                } else if (state.connectionState === CONNECTION_STATE.DISCONNECTED) {
                    finish(new BridgeError(ERROR_CODE.MULTIPLAYER_CONNECTION_FAILED))
                }
            })
            if (isDone) {
                unsubscribe()
            }
        })
    }

    #attach(handle: RoomHandle): void {
        this.#handle = handle
        this.#players = handle.players
        this.#hostId = handle.hostPlayerId
        this.#isHost = handle.isHost
        this.#roomSnapshot = this.room
        this.#closeReason = null
        this.#isLaunchRoomUsed = true

        // Subscriptions report the current values right away: they match what is stored above.
        this.#unsubscribers = [
            handle.onMessage(({ type, data, from }) => {
                eventBus.emit(EVENT_NAME.MULTIPLAYER_MESSAGE_RECEIVED, { type, data, from })
            }),
            handle.onPlayersChange((players) => this.#onPlayersChange(players)),
            handle.onRoomChange(() => this.#onRoomChange()),
            handle.onStateChange((state) => this.#onStateChange(state)),
            handle.onError((error) => this.#onError(error)),
        ]

        this.#setState(MULTIPLAYER_STATE.CONNECTED)
        this.#notifyRoomChanged()
    }

    #detach(reason: RoomLeaveReason): void {
        if (!this.#handle) {
            return
        }

        this.#unsubscribers.forEach((unsubscribe) => unsubscribe())
        this.#unsubscribers = []
        this.#clearOutgoing()
        this.#handle = null
        this.#players = []
        this.#hostId = null
        this.#isHost = false
        this.#roomSnapshot = null
        this.#syncState = {}
        this.#setState(MULTIPLAYER_STATE.DISCONNECTED)
        this.#notifyRoomChanged()
        eventBus.emit(EVENT_NAME.MULTIPLAYER_ROOM_LEFT, reason)
    }

    #onPlayersChange(players: RoomMember[]): void {
        const previous = new Map(this.#players.map((player) => [player.id, player]))
        this.#players = players

        players.forEach((player) => {
            const old = previous.get(player.id)
            previous.delete(player.id)
            if (!old) {
                eventBus.emit(EVENT_NAME.MULTIPLAYER_PLAYER_JOINED, this.#toPlayer(player))
            } else if (!isEqual(old, player)) {
                eventBus.emit(EVENT_NAME.MULTIPLAYER_PLAYER_UPDATED, this.#toPlayer(player))
            }
        })
        previous.forEach((player) => eventBus.emit(EVENT_NAME.MULTIPLAYER_PLAYER_LEFT, this.#toPlayer(player)))

        this.#updateHost()
        this.#notifyRoomChanged()
    }

    #onRoomChange(): void {
        this.#updateHost()

        const { room } = this
        if (!isEqual(room, this.#roomSnapshot)) {
            this.#roomSnapshot = room
            eventBus.emit(EVENT_NAME.MULTIPLAYER_ROOM_UPDATED, room)
            this.#notifyRoomChanged()
        }
    }

    #onStateChange(state: ConnectionStatus): void {
        const handle = this.#handle
        switch (state.connectionState) {
            case CONNECTION_STATE.CONNECTED:
                this.#setState(MULTIPLAYER_STATE.CONNECTED)
                break
            case CONNECTION_STATE.RECONNECTING:
                this.#setState(MULTIPLAYER_STATE.RECONNECTING)
                break
            default:
                // The error with the cause, if any, follows this state: wait for it.
                queueMicrotask(() => {
                    if (this.#handle === handle) {
                        this.#detach(this.#closeReason ?? ROOM_LEAVE_REASON.CONNECTION_LOST)
                    }
                })
                return
        }

        this.#updateHost()
    }

    #onError(error: MultiplayerError): void {
        logger.warn('[multiplayer]', error.code, error.message)
        if (ROOM_ENDED_ERRORS.includes(error.code)) {
            this.#closeReason = ROOM_LEAVE_REASON.ROOM_CLOSED
        }
    }

    // Also reports the local host role turning active or suspended, so isHost never changes silently.
    #updateHost(): void {
        const hostId = this.#handle?.hostPlayerId ?? null
        const { isHost } = this
        if (hostId === this.#hostId && isHost === this.#isHost) {
            return
        }

        this.#hostId = hostId
        this.#isHost = isHost
        const host = this.#players.find((player) => player.id === hostId)
        eventBus.emit(EVENT_NAME.MULTIPLAYER_HOST_CHANGED, host ? this.#toPlayer(host) : null)
    }

    #queueMessage(message: OutgoingMessage): void {
        if (this.#outgoing.length >= MULTIPLAYER_DEFAULTS.MAX_QUEUED_MESSAGES) {
            logger.warn('[multiplayer] Message was not sent: too many messages are waiting')
            return
        }

        this.#outgoing.push(message)
        if (this.#outgoing.length === 1) {
            this.#sendOutgoing()
        }
    }

    // The transport refuses frames over its rate instead of queuing them: they are retried here.
    #sendOutgoing(): void {
        this.#sendTimer = undefined
        while (this.#outgoing.length > 0) {
            const { type, data, to } = this.#outgoing[0]
            try {
                this.#handle?.send(type, data, to)
            } catch (error) {
                if (error instanceof MultiplayerError && error.code === RATE_LIMITED_ERROR) {
                    this.#sendTimer = setTimeout(() => this.#sendOutgoing(), MULTIPLAYER_DEFAULTS.SEND_RETRY_DELAY)
                    return
                }
                logger.warn('[multiplayer] Message was not sent:', error)
            }
            this.#outgoing.shift()
        }
    }

    #clearOutgoing(): void {
        clearTimeout(this.#sendTimer)
        this.#sendTimer = undefined
        this.#outgoing = []
    }

    #updateRoom(patch: { isOpen?: boolean, isVisible?: boolean, properties?: JsonObject }): void {
        if (!this.#handle) {
            logger.warn('[multiplayer] Room settings changed outside of a room')
            return
        }

        this.#handle.setRoom(patch).catch((error) => {
            logger.warn('[multiplayer] Room settings were not changed:', error)
        })
    }

    #loadRuntime(): Promise<MultiplayerRuntime> {
        if (!this.#runtime) {
            const { apiBase = MULTIPLAYER_DEFAULTS.API_BASE } = this.#getConfig()
            const config = { apiBase, appToken: this.#getPublicToken() }
            this.#runtime = import(/* webpackChunkName: "multiplayer" */ './transport/Runtime')
                .then(({ default: Runtime }) => new Runtime(config, () => this.#getHeaders()))
                .catch((error) => {
                    this.#runtime = null
                    throw error
                })
        }
        return this.#runtime
    }

    #getHeaders(): Record<string, string> {
        const { platformId, playerId } = this._platformBridge
        return playerId ? { 'x-platform-id': platformId, 'x-player-id': playerId } : { 'x-platform-id': platformId }
    }

    #getConfig(): MultiplayerConfig {
        return bridgeConfig.getValues().multiplayer ?? {}
    }

    #getPublicToken(): string {
        return bridgeConfig.getValues().saas?.publicToken || ''
    }

    #getMaxPlayers(maxPlayers?: number): number {
        return maxPlayers ?? MULTIPLAYER_DEFAULTS.MAX_PLAYERS
    }

    // The filter is not part of the room data on the server: its values are copied into the properties,
    // so every player sees them.
    #getRoomProperties(options: Pick<CreateRoomOptions, 'properties' | 'filter'>): JsonObject {
        return { ...options.properties, ...options.filter } as JsonObject
    }

    #getPlayer(options: PlayerOptions): { name: string, properties: JsonObject } {
        return {
            name: (options.playerName || this._platformBridge.playerName || '').slice(0, MAX_PLAYER_NAME_LENGTH),
            properties: (options.playerProperties ?? {}) as JsonObject,
        }
    }

    #toPlayer(player: RoomMember): MultiplayerPlayer {
        return {
            id: player.id,
            name: player.name,
            isHost: player.id === this.#hostId,
            isConnected: true,
            properties: { ...player.properties },
        }
    }

    #toBridgeError(error: unknown): BridgeError {
        if (error instanceof BridgeError) {
            return error
        }

        const code = error instanceof MultiplayerError ? BACKEND_ERRORS[error.code] : undefined
        return new BridgeError(code ?? ERROR_CODE.MULTIPLAYER_CONNECTION_FAILED, error)
    }

    #setState(state: MultiplayerState): void {
        if (this.#state === state) {
            return
        }

        this.#state = state
        eventBus.emit(EVENT_NAME.MULTIPLAYER_STATE_CHANGED, state)
    }

    #notifyRoomChanged(): void {
        const { room } = this
        this._platformBridge.notifyMultiplayerRoomChanged(room
            ? {
                id: room.id,
                type: room.type,
                maxPlayers: room.maxPlayers,
                playerCount: this.#players.length,
                isOpen: room.isOpen,
                isVisible: room.isVisible,
            }
            : null)
    }
}

applyEventBusMixin(MultiplayerModule.prototype)

export default MultiplayerModule
