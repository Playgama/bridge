import { MultiplayerError } from './types'
import type { MultiplayerSyncOptions } from './types'
import {
    decimal, encodeJson, decodeJson, frame, unframe, uuid,
} from './protocol'
import type { HostMetadata } from './protocol'

export interface SyncContext extends HostMetadata {
    connected: boolean
    roomId: string
    playerId: string
    ownerEpoch: string
    generation: number
}

export interface SyncTransport {
    context(): SyncContext
    control(message: object): boolean
    bytes(message: Uint8Array): boolean
    changed(): void
    error(error: MultiplayerError): void
    rejoin(): void
}

interface Retained {
    payload: Uint8Array
    hostEpoch: string
    seq: string
}

export default class StateSync {
    private transport: SyncTransport

    private options: MultiplayerSyncOptions<object>

    private registrationId = ''

    private registered = false

    private ready = false

    private suspended = false

    private failure?: MultiplayerError

    private retained?: Retained

    private pending?: Retained

    private applied?: { hostEpoch: string; seq: string }

    private appliedAck = false

    private lastApplied = 0n

    private seq = 0n

    private assignment = ''

    private prepared = false

    private firstAccepted = false

    private timer?: ReturnType<typeof setInterval>

    private lastControl = -Infinity

    private lastSnapshot = -Infinity

    private pausedUntil = 0

    private stoppedAck = false

    private disposed = false

    get isReady(): boolean {
        const context = this.transport.context()
        return context.connected && context.hostStatus === 'active' && this.registered
            && this.ready && !this.failure && !this.suspended
    }

    get isHost(): boolean {
        const context = this.transport.context()
        return this.isReady && context.hostPlayerId === context.playerId && this.firstAccepted
    }

    get error(): MultiplayerError | undefined {
        return this.failure
    }

    constructor(transport: SyncTransport, options: MultiplayerSyncOptions<object>) {
        const rate = options.updatesPerSecond ?? 10
        if (!Number.isFinite(rate) || rate < 1 || rate > 10
            || typeof options.getState !== 'function' || typeof options.applyState !== 'function') {
            throw new MultiplayerError('INVALID_REQUEST', 'syncState needs two callbacks and a rate from 1 to 10')
        }
        this.transport = transport
        this.options = { ...options, updatesPerSecond: rate }
    }

    connected(): void {
        this.disconnected()
        if (this.failure || this.disposed) return
        const before = this.transport.context()
        this.registrationId = uuid()
        this.assignment = ''
        this.registered = false
        this.lastControl = -Infinity
        this.pausedUntil = 0
        if (this.retained && !this.apply(decodeJson(this.retained.payload, true) as object)) return
        const after = this.transport.context()
        if (this.disposed || !after.connected || before.generation !== after.generation
            || before.ownerEpoch !== after.ownerEpoch || before.hostEpoch !== after.hostEpoch) return
        this.metadata()
        if (this.disposed || !this.transport.context().connected
            || before.generation !== this.transport.context().generation) return
        this.timer = setInterval(() => this.tick(), 1000 / this.options.updatesPerSecond!)
        this.tick()
    }

    disconnected(): void {
        clearInterval(this.timer)
        this.timer = undefined
        this.registered = false
        this.ready = false
        this.pending = undefined
        this.applied = undefined
        this.firstAccepted = false
        this.prepared = false
        this.suspended = false
        this.transport.changed()
    }

    dispose(): void {
        this.disposed = true
        this.disconnected()
        this.retained = undefined
    }

    metadata(): void {
        const context = this.transport.context()
        const assignment = `${context.generation}:${context.ownerEpoch}:${context.hostEpoch}`
        if (assignment !== this.assignment) {
            this.assignment = assignment
            this.seq = 0n
            this.lastApplied = 0n
            this.ready = false
            this.firstAccepted = false
            this.pending = undefined
            this.applied = undefined
            this.appliedAck = false
            this.prepared = false
            this.lastSnapshot = -Infinity
            this.lastControl = -Infinity
            this.pausedUntil = 0
        }
        // Repeated metadata is the response to STALE_HOST, not a new assignment or first-snapshot ACK.
        this.suspended = false
        if (context.hostStatus === 'none' || context.hostStatus === 'waiting') this.ready = false
        if (context.hostStatus === 'active' && this.firstAccepted && context.hostPlayerId === context.playerId) {
            this.ready = true
        }
        this.transport.changed()
    }

    control(value: unknown): void {
        const message = value as Record<string, unknown> | null
        const context = this.transport.context()
        if (!message || !context.connected || message.v !== 1 || message.roomId !== context.roomId
            || message.ownerEpoch !== context.ownerEpoch || message.registrationId !== this.registrationId) return
        if (message.kind === 'error') {
            // Fence ALL error effects before touching role, readiness, retry timers or first snapshot.
            if (message.requestHostEpoch !== null && message.requestHostEpoch !== context.hostEpoch) return
            if (message.requestHostEpoch === null
                && ['STALE_HOST', 'HOST_PREPARATION_TIMEOUT'].includes(String(message.code))) return
            if (message.code === 'STALE_EPOCH') {
                this.transport.rejoin()
            } else if (message.code === 'STALE_HOST') {
                this.suspended = true
                this.ready = false
            } else if (message.code === 'RATE_LIMITED' || message.code === 'COORDINATION_UNAVAILABLE') {
                this.pausedUntil = Date.now() + Math.max(1000, Number(message.retryAfterMs) || 1000)
            } else {
                this.fail(new MultiplayerError(String(message.code), String(message.message || message.code)))
            }
            this.transport.changed()
            return
        }
        if (message.kind === 'stopped') {
            this.stoppedAck = true
            if (this.failure) clearInterval(this.timer)
            return
        }
        if (this.failure) return
        if (message.kind === 'registered') {
            this.registered = true
            this.lastControl = -Infinity
            return
        }
        if (!this.registered || message.hostEpoch !== context.hostEpoch) return
        if (message.kind === 'state_accepted' && context.hostStatus === 'active'
            && context.hostPlayerId === context.playerId && this.pending?.seq === message.seq) {
            this.firstAccepted = true
            this.ready = true
            this.pending = undefined
            this.transport.changed()
        } else if (message.kind === 'applied_ack' && this.applied?.seq === message.seq) {
            this.appliedAck = true
        }
        // request_state is coalesced into the next periodic fresh snapshot.
    }

    snapshot(bytes: Uint8Array): void {
        const context = this.transport.context()
        if (!context.connected || !this.registered || this.failure || this.suspended
            || context.hostStatus !== 'active' || context.hostPlayerId === context.playerId) return
        try {
            const { header, payload } = unframe(bytes)
            if (header.v !== 1 || header.roomId !== context.roomId || header.ownerEpoch !== context.ownerEpoch
                || header.hostEpoch !== context.hostEpoch || header.from !== context.hostPlayerId
                || !decimal(header.seq) || BigInt(header.seq) <= this.lastApplied) return
            // Decode and validate before invoking application code, retaining separate immutable bytes.
            const state = decodeJson(payload, true) as object
            const retained = { payload: payload.slice(), hostEpoch: context.hostEpoch, seq: header.seq }
            const { assignment } = this
            if (!this.apply(state) || this.disposed || assignment !== this.assignment
                || !this.transport.context().connected) return
            this.retained = retained
            this.lastApplied = BigInt(header.seq)
            this.ready = true
            if (!this.applied) this.applied = { hostEpoch: context.hostEpoch, seq: header.seq }
            this.transport.changed()
        } catch (error) {
            this.fail(error instanceof MultiplayerError ? error : new MultiplayerError('SYNC_STATE_INVALID'))
        }
    }

    private tick(): void {
        const context = this.transport.context()
        const now = Date.now()
        if (this.disposed || !context.connected || now < this.pausedUntil) return
        if (this.failure) {
            if (!this.stoppedAck) this.sendControl('unregister', {}, now)
            return
        }
        if (!this.registered) {
            this.sendControl('register', {
                retained: this.retained ? { hostEpoch: this.retained.hostEpoch, seq: this.retained.seq } : null,
            }, now)
            return
        }
        if (this.suspended || !['preparing', 'active'].includes(context.hostStatus)) return
        if (context.hostPlayerId !== context.playerId) {
            if (this.applied && !this.appliedAck) this.sendControl('applied', this.applied, now)
            else if (!this.ready) this.sendControl('request_state', { hostEpoch: context.hostEpoch }, now)
            return
        }
        if (!this.prepared) {
            if (context.syncStarted && !this.retained) return
            const { assignment } = this
            if (this.retained && !this.apply(decodeJson(this.retained.payload, true) as object)) return
            if (assignment !== this.assignment || !this.canCapture()) return
            this.prepared = true
        }
        if (this.pending && now - this.lastSnapshot < 1000) return
        const { assignment } = this
        try {
            let snapshot = this.pending
            if (!snapshot) {
                let value: unknown
                try { value = this.options.getState() } catch { throw new MultiplayerError('SYNC_CALLBACK_FAILED') }
                if (value && typeof (value as { then?: unknown }).then === 'function') {
                    Promise.resolve(value).catch(() => {})
                    throw new MultiplayerError('SYNC_CALLBACK_FAILED', 'getState must be synchronous')
                }
                const payload = encodeJson(value, true)
                if (assignment !== this.assignment || !this.canCapture()) return
                this.seq += 1n
                snapshot = { payload, hostEpoch: context.hostEpoch, seq: this.seq.toString() }
                this.retained = snapshot
                if (!this.firstAccepted) this.pending = snapshot
            }
            const message = frame({
                v: 1,
                roomId: context.roomId,
                ownerEpoch: context.ownerEpoch,
                registrationId: this.registrationId,
                hostEpoch: snapshot.hostEpoch,
                seq: snapshot.seq,
            }, snapshot.payload)
            if (this.transport.bytes(message)) this.lastSnapshot = now
        } catch (error) {
            this.fail(error instanceof MultiplayerError ? error : new MultiplayerError('SYNC_CALLBACK_FAILED'))
        }
    }

    private sendControl(kind: string, fields: object, now: number): void {
        if (now - this.lastControl < 1000) return
        const context = this.transport.context()
        if (this.transport.control({
            v: 1, kind, roomId: context.roomId, ownerEpoch: context.ownerEpoch, registrationId: this.registrationId, ...fields,
        })) this.lastControl = now
    }

    private canCapture(): boolean {
        const context = this.transport.context()
        return context.connected && context.hostPlayerId === context.playerId
            && ['preparing', 'active'].includes(context.hostStatus) && !this.failure && !this.suspended
    }

    private apply(state: object): boolean {
        try {
            const result: unknown = this.options.applyState(state)
            if (result && typeof (result as { then?: unknown }).then === 'function') {
                // Observe a rejected promise without allowing asynchronous completion to restore authority.
                Promise.resolve(result).catch(() => {})
                throw new MultiplayerError('SYNC_CALLBACK_FAILED', 'applyState must be synchronous')
            }
            return true
        } catch {
            this.fail(new MultiplayerError('SYNC_CALLBACK_FAILED', 'applyState failed or returned a Promise'))
            return false
        }
    }

    private fail(error: MultiplayerError): void {
        if (this.failure) return
        this.failure = error
        this.ready = false
        this.pending = undefined
        this.retained = undefined
        this.lastControl = -Infinity
        this.transport.changed()
        this.transport.error(error)
        this.tick()
    }
}
