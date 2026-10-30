/* eslint-disable no-await-in-loop -- Each handle has one cancellable recovery sequence. */
/* eslint-disable max-classes-per-file -- Subscribers is private to the room handle. */
import HttpClient, { delay, remaining } from './HttpClient'
import NativeConnection, { needsRejoin, terminalClose } from './NativeConnection'
import StateSync from './StateSync'
import { MultiplayerError } from './types'
import { admit, terminalAdmissionError } from './admission'
import type {
    MultiplayerRoom, MultiplayerConnectionState, MultiplayerState, MultiplayerPlayer,
    MultiplayerProperties, MultiplayerRoomPatch, MultiplayerSyncOptions, MultiplayerRecipient,
    MultiplayerJson, MultiplayerMessage, MultiplayerBytesMessage,
} from './types'
import {
    uuid, decimal, encodeJson, frame, unframe, SendBudget, invitation, MAX_BUFFERED_BYTES,
} from './protocol'
import type {
    Reservation, Session, RoomMetadata, Welcome,
} from './protocol'

class Subscribers<T> {
    private callbacks = new Set<(value: T) => void>()

    add(callback: (value: T) => void): () => void {
        this.callbacks.add(callback)
        return () => this.callbacks.delete(callback)
    }

    emit(value: T): void {
        this.callbacks.forEach((callback) => {
            try { callback(value) } catch (error) { console.error('Multiplayer observer failed', error) }
        })
    }

    clear(): void { this.callbacks.clear() }
}

interface PendingCommand {
    command: 'set_room' | 'set_player'
    payload: object
    nextAt: number
    deadline: number
    resolve(): void
    reject(error: MultiplayerError): void
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export default class RoomHandle implements MultiplayerRoom {
    private http: HttpClient

    private session: Session

    private removed: () => void

    private native?: NativeConnection

    private reservation!: Reservation

    private metadata!: RoomMetadata

    private members: MultiplayerPlayer[] = []

    private code = ''

    private ownerEpoch = ''

    private revision = '0'

    private generation = 0

    private state: MultiplayerConnectionState = 'reconnecting'

    private sync?: StateSync

    private closed = false

    private everConnected = false

    private controller = new AbortController()

    private recovery?: Promise<void>

    private leaving?: Promise<void>

    private welcome?: { resolve(): void; reject(error: MultiplayerError): void }

    private budget = new SendBudget()

    private controls = new Map<string, PendingCommand>()

    private controlTokens = 4

    private controlAt = Date.now()

    private controlTimer?: ReturnType<typeof setInterval>

    private messages = new Subscribers<MultiplayerMessage>()

    private bytesMessages = new Subscribers<MultiplayerBytesMessage>()

    private playersChanged = new Subscribers<MultiplayerPlayer[]>()

    private stateChanged = new Subscribers<MultiplayerState>()

    private roomChanged = new Subscribers<MultiplayerRoom>()

    private errors = new Subscribers<MultiplayerError>()

    get id(): string { return this.reservation.roomId }

    get playerId(): string { return this.reservation.playerId }

    get inviteCode(): string { return this.code }

    get players(): MultiplayerPlayer[] { return copy(this.members) }

    get properties(): MultiplayerProperties { return copy(this.metadata.properties) }

    constructor(http: HttpClient, session: Session, removed: () => void) {
        this.http = http
        this.session = session
        this.removed = removed
    }

    get hostPlayerId(): string | null { return this.metadata.hostPlayerId }

    get info(): RoomMetadata { return copy(this.metadata) }

    get connectionState(): MultiplayerConnectionState { return this.state }

    get isReady(): boolean { return this.sync ? this.sync.isReady : this.state === 'connected' }

    get isHost(): boolean { return this.sync?.isHost || false }

    async connect(reservation: Reservation, token?: string, timeoutMs = 10000): Promise<void> {
        if (this.closed) throw new MultiplayerError('CANCELLED')
        this.native?.stop()
        this.reservation = reservation
        this.state = 'reconnecting'
        this.generation += 1
        const { generation } = this
        this.sync?.disconnected()
        const valid = (): boolean => generation === this.generation && !this.closed
        const onBytes = (bytes: Uint8Array, sync = false): void => {
            if (!valid() || this.state !== 'connected') return
            if (sync) this.sync?.snapshot(bytes)
            else this.receiveBytes(bytes)
        }
        const native = new NativeConnection({
            control: (value) => { if (valid()) this.control(value) },
            syncControl: (value) => { if (valid()) this.sync?.control(value) },
            relay: (value) => onBytes(value),
            snapshot: (value) => onBytes(value, true),
            closed: (code) => {
                if (!valid()) return
                const terminal = terminalClose(code)
                if (this.welcome) this.welcome.reject(new MultiplayerError(terminal || 'CONNECTION_LOST'))
                else if (terminal) this.finish(new MultiplayerError(terminal))
                else this.recover(needsRejoin(code))
            },
        })
        this.native = native
        let timeout: ReturnType<typeof setTimeout> | undefined
        let abort = (): void => {}
        const welcomed = new Promise<void>((resolve, reject) => {
            this.welcome = { resolve, reject }
            abort = () => reject(new MultiplayerError('CANCELLED'))
            this.controller.signal.addEventListener('abort', abort, { once: true })
            timeout = setTimeout(() => reject(new MultiplayerError('WELCOME_TIMEOUT')), timeoutMs)
        })
        // consumeSeatReservation may resolve on JOIN_ROOM before welcome, or fail independently.
        native.connect(reservation, this.session.apiBase, this.controller.signal, token)
            .catch((error) => {
                if (valid()) {
                    this.welcome?.reject(error instanceof MultiplayerError
                        ? error : new MultiplayerError('CONNECTION_LOST'))
                }
            })
        try {
            await welcomed
            if (this.closed || generation !== this.generation) throw new MultiplayerError('CANCELLED')
            this.everConnected = true
            if (!this.controlTimer) this.controlTimer = setInterval(() => this.flushControls(), 100)
        } catch (error) {
            if (valid()) {
                native.stop()
                this.state = 'reconnecting'
            }
            throw error
        } finally {
            clearTimeout(timeout)
            this.controller.signal.removeEventListener('abort', abort)
            if (valid()) this.welcome = undefined
        }
    }

    syncState<T extends object>(options: MultiplayerSyncOptions<T>): void {
        if (this.sync) throw new MultiplayerError('SYNC_ALREADY_CONFIGURED')
        if (this.closed) throw new MultiplayerError('NOT_CONNECTED')
        this.sync = new StateSync({
            context: () => ({
                ...this.metadata,
                roomId: this.id,
                playerId: this.playerId,
                ownerEpoch: this.ownerEpoch,
                generation: this.generation,
                connected: this.state === 'connected' && !this.closed,
            }),
            control: (message) => this.sendControl('sync_control', message),
            bytes: (message) => this.sendFrame('sync_state', message),
            changed: () => this.emitState(),
            error: (error) => this.errors.emit(error),
            rejoin: () => this.recover(true),
        }, { ...options, applyState: (state) => options.applyState(state as T) })
        this.emitState()
        if (this.state === 'connected') this.sync.connected()
    }

    send(type: string, data: MultiplayerJson, to: MultiplayerRecipient = 'others'): void {
        this.sendBytes(type, encodeJson(data), to)
    }

    sendBytes(type: string, data: Uint8Array, to: MultiplayerRecipient = 'others'): void {
        this.requireConnected()
        if (!type || new TextEncoder().encode(type).length > 64 || !(data instanceof Uint8Array)) {
            throw new MultiplayerError('INVALID_REQUEST')
        }
        const recipients = Array.isArray(to) ? to : [to]
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if ((to !== 'others' && recipients.some((recipient) => !uuidPattern.test(recipient)))
            || recipients.length > this.metadata.maxPlayers || new Set(recipients).size !== recipients.length) {
            throw new MultiplayerError('INVALID_REQUEST', 'Recipients must be player UUIDs or others')
        }
        if (!this.sendFrame('relay', frame({ v: 1, type, to }, data))) {
            throw new MultiplayerError('RATE_LIMITED', 'Outgoing budget is full; gameplay was not queued')
        }
    }

    onMessage(callback: (message: MultiplayerMessage) => void): () => void { return this.messages.add(callback) }

    onMessageBytes(callback: (message: MultiplayerBytesMessage) => void): () => void { return this.bytesMessages.add(callback) }

    onPlayersChange(callback: (players: MultiplayerPlayer[]) => void): () => void {
        const unsubscribe = this.playersChanged.add(callback)
        callback(this.players)
        return unsubscribe
    }

    onRoomChange(callback: (room: MultiplayerRoom) => void): () => void {
        const unsubscribe = this.roomChanged.add(callback)
        callback(this)
        return unsubscribe
    }

    onStateChange(callback: (state: MultiplayerState) => void): () => void {
        const unsubscribe = this.stateChanged.add(callback)
        callback(this.currentState())
        return unsubscribe
    }

    onError(callback: (error: MultiplayerError) => void): () => void {
        const unsubscribe = this.errors.add(callback)
        if (this.sync?.error) callback(this.sync.error)
        return unsubscribe
    }

    setRoom(patch: MultiplayerRoomPatch): Promise<void> { return this.command('set_room', patch) }

    setPlayer(properties: MultiplayerProperties): Promise<void> { return this.command('set_player', { properties }) }

    leave(): Promise<void> {
        if (this.leaving) return this.leaving
        let resolve!: () => void
        let reject!: (error: unknown) => void
        const pending = new Promise<void>((onSuccess, onFailure) => { resolve = onSuccess; reject = onFailure })
        // Install the shared result before any synchronous observer can call leave again.
        this.leaving = pending
        this.closed = true
        this.generation += 1
        this.state = 'disconnected'
        this.controller.abort()
        this.sync?.dispose()
        clearInterval(this.controlTimer)
        this.native?.stop()
        this.rejectControls(new MultiplayerError('CANCELLED'))
        this.emitState()
        this.http.request('/rooms/leave', { roomId: this.id }, this.session, uuid())
            .then(() => {})
            .finally(() => {
                this.native?.stop()
                clearInterval(this.controlTimer)
                this.removed()
                this.messages.clear()
                this.bytesMessages.clear()
                this.playersChanged.clear()
                this.roomChanged.clear()
                this.stateChanged.clear()
                this.errors.clear()
            })
            .then(resolve, reject)
        return pending
    }

    abandon(): void {
        this.finish()
    }

    private requireConnected(): void {
        if (this.closed || this.state !== 'connected' || !this.native?.open) throw new MultiplayerError('NOT_CONNECTED')
    }

    private sendFrame(channel: string, message: Uint8Array): boolean {
        if (this.closed || this.state !== 'connected' || !this.native?.open
            || this.native.buffered > MAX_BUFFERED_BYTES || !this.budget.take(message.length)) return false
        this.native.sendBytes(channel, message)
        return true
    }

    private sendControl(channel: string, message: object): boolean {
        const now = Date.now()
        this.controlTokens = Math.min(4, this.controlTokens + (now - this.controlAt) / 500)
        this.controlAt = now
        if (this.closed || this.state !== 'connected' || !this.native?.open || this.controlTokens < 1) return false
        this.controlTokens -= 1
        this.native.send(channel, message)
        return true
    }

    private currentState(): MultiplayerState {
        let syncState: MultiplayerState['syncState'] = this.isReady ? 'ready' : 'syncing'
        if (this.sync?.error) syncState = 'error'
        return {
            connectionState: this.state,
            syncState,
            isReady: this.isReady,
            isHost: this.isHost,
        }
    }

    private emitState(): void { this.stateChanged.emit(this.currentState()) }

    private receiveBytes(bytes: Uint8Array): void {
        try {
            const { header, payload } = unframe(bytes)
            if (header.v !== 1 || header.ownerEpoch !== this.ownerEpoch
                || typeof header.type !== 'string' || typeof header.from !== 'string') return
            this.bytesMessages.emit({ type: header.type, from: header.from, data: payload.slice() })
            try {
                const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)) as MultiplayerJson
                this.messages.emit({ type: header.type, from: header.from, data })
            } catch { /* Raw binary messages are exposed by onMessageBytes only. */ }
        } catch { this.finish(new MultiplayerError('PROTOCOL_VIOLATION')) }
    }

    private control(value: unknown): void {
        const envelope = value as { v?: number; event?: string; payload?: any } | null
        if (!envelope || envelope.v !== 1 || !envelope.payload) return
        const { payload, event } = envelope
        if (event === 'welcome') {
            if (!this.welcome) return
            const valid = payload.roomId === this.id && payload.selfPlayerId === this.playerId
                && payload.ownerEpoch === this.reservation.ownerEpoch
                && payload.connectionGeneration === this.reservation.connectionGeneration
                && payload.room?.id === this.id && payload.room?.region === this.session.region
                && decimal(payload.revision) && decimal(payload.room?.hostEpoch)
                && Array.isArray(payload.players) && payload.players.some((p: MultiplayerPlayer) => p.id === this.playerId)
            if (!valid) {
                this.welcome.reject(new MultiplayerError('PROTOCOL_VIOLATION', 'Welcome does not match admission'))
                return
            }
            try {
                const code = invitation(payload.inviteCode)
                if (code.region !== this.session.region) throw new MultiplayerError('PROTOCOL_VIOLATION')
            } catch {
                this.welcome.reject(new MultiplayerError('PROTOCOL_VIOLATION'))
                return
            }
            const welcome = payload as Welcome
            this.ownerEpoch = welcome.ownerEpoch
            this.revision = welcome.revision
            this.metadata = copy(welcome.room)
            this.members = copy(welcome.players)
            this.code = welcome.inviteCode
            this.state = 'connected'
            const pending = this.welcome
            this.welcome = undefined
            this.everConnected = true
            pending.resolve()
            this.sync?.connected()
            this.playersChanged.emit(this.players)
            this.roomChanged.emit(this)
            this.emitState()
            return
        }
        if (this.state !== 'connected' || payload.roomId !== this.id || payload.ownerEpoch !== this.ownerEpoch
            || !decimal(payload.revision)) return
        if (event === 'ack' || event === 'error') {
            const command = this.controls.get(payload.requestId)
            if (!command) return
            if (event === 'ack') {
                this.controls.delete(payload.requestId)
                command.resolve()
            } else if (payload.code === 'STALE_EPOCH') this.recover(true)
            else if (['RATE_LIMITED', 'COORDINATION_UNAVAILABLE', 'INTERNAL'].includes(payload.code)) {
                command.nextAt = Date.now() + Math.max(1000, payload.retryAfterMs || 0)
            } else {
                this.controls.delete(payload.requestId)
                command.reject(new MultiplayerError(payload.code, payload.message))
            }
            return
        }
        if (event === 'maintenance') { this.recover(true, payload.retryAfterMs); return }
        if (event === 'room_closed') { this.finish(new MultiplayerError('ROOM_ENDED', payload.reason)); return }
        if (event === 'relay_error') {
            this.errors.emit(new MultiplayerError(payload.code, payload.message, payload.retryAfterMs))
            return
        }
        if (BigInt(payload.revision) < BigInt(this.revision)) return
        this.revision = payload.revision
        if (event === 'host_changed') {
            if (!decimal(payload.hostEpoch)) { this.finish(new MultiplayerError('PROTOCOL_VIOLATION')); return }
            Object.assign(this.metadata, {
                hostPlayerId: payload.hostPlayerId,
                hostEpoch: payload.hostEpoch,
                hostStatus: payload.hostStatus,
                syncStarted: payload.syncStarted,
            })
            this.sync?.metadata()
            this.roomChanged.emit(this)
        } else if (event === 'room_updated') {
            this.metadata = copy(payload.room)
            this.sync?.metadata()
            this.roomChanged.emit(this)
        } else if (event === 'player_joined' || event === 'player_updated') {
            this.members = this.members.filter((player) => player.id !== payload.player.id)
            this.members.push(copy(payload.player))
            this.playersChanged.emit(this.players)
        } else if (event === 'player_left') {
            this.members = this.members.filter((player) => player.id !== payload.playerId)
            this.playersChanged.emit(this.players)
        }
    }

    private command(command: PendingCommand['command'], payload: object): Promise<void> {
        try {
            this.requireConnected()
            if (this.controls.size >= 32) throw new MultiplayerError('RATE_LIMITED')
            encodeJson(payload)
            if (command === 'set_room' && this.metadata.creatorId !== this.playerId) throw new MultiplayerError('FORBIDDEN')
        } catch (error) { return Promise.reject(error) }
        return new Promise((resolve, reject) => {
            this.controls.set(uuid(), {
                command, payload: copy(payload), resolve, reject, nextAt: 0, deadline: Date.now() + 120000,
            })
            this.flushControls()
        })
    }

    private flushControls(): void {
        this.controls.forEach((command, requestId) => {
            if (Date.now() >= command.deadline) {
                this.controls.delete(requestId)
                command.reject(new MultiplayerError('COMMAND_TIMEOUT'))
            } else if (this.state === 'connected' && command.nextAt <= Date.now()) {
                if (command.command === 'set_room' && this.metadata.creatorId !== this.playerId) {
                    this.controls.delete(requestId)
                    command.reject(new MultiplayerError('FORBIDDEN'))
                } else if (this.sendControl('control', {
                    v: 1,
                    command: command.command,
                    requestId,
                    payload: { roomId: this.id, ownerEpoch: this.ownerEpoch, ...command.payload },
                })) Object.assign(command, { nextAt: Date.now() + 1000 })
            }
        })
    }

    private recover(httpOnly = false, retryAfterMs = 0): void {
        if (this.closed || this.recovery || !this.everConnected) return
        const token = this.native?.token
        const { reservation } = this
        this.native?.stop()
        this.state = 'reconnecting'
        this.sync?.disconnected()
        this.emitState()
        this.recovery = this.recoverLoop(reservation, httpOnly ? undefined : token, retryAfterMs)
            .catch((error) => {
                if (!this.closed) this.finish(error instanceof MultiplayerError ? error : new MultiplayerError('CONNECTION_LOST'))
            })
            .finally(() => { this.recovery = undefined })
    }

    private async recoverLoop(reservation: Reservation, token?: string, retryAfterMs = 0): Promise<void> {
        const { signal } = this.controller
        const deadline = Date.now() + 120000
        const nativeDeadline = Math.min(deadline, Date.now() + 20000)
        try {
            if (token) {
                while (Date.now() < nativeDeadline) {
                    await delay(500 + Math.random() * 250, signal, deadline)
                    if (Date.now() >= nativeDeadline) break
                    try {
                        await this.connect(reservation, token, Math.min(5000, remaining(nativeDeadline, signal)))
                        remaining(deadline, signal)
                        return
                    } catch (error) {
                        if (terminalAdmissionError(error)) throw error
                    }
                }
            }
            await delay(Math.max(Number(retryAfterMs) || 0, Math.random() * 2000), signal, deadline)
            await admit({
                http: this.http,
                session: this.session,
                path: '/rooms/rejoin',
                body: { roomId: this.id },
                deadline,
                signal,
                connect: (grant, timeoutMs) => this.connect(grant, undefined, timeoutMs),
            })
        } catch (error) {
            if (error instanceof MultiplayerError && error.code === 'NETWORK_TIMEOUT') {
                throw new MultiplayerError('RETURN_EXPIRED')
            }
            throw error
        }
    }

    private rejectControls(error: MultiplayerError): void {
        this.controls.forEach((command) => command.reject(error))
        this.controls.clear()
    }

    private finish(error?: MultiplayerError): void {
        if (this.closed) return
        this.closed = true
        this.state = 'disconnected'
        this.generation += 1
        this.controller.abort()
        this.native?.stop()
        this.sync?.disconnected()
        clearInterval(this.controlTimer)
        this.rejectControls(error || new MultiplayerError('CANCELLED'))
        this.removed()
        this.emitState()
        if (error) this.errors.emit(error)
    }
}
