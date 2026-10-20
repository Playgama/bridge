/* eslint-disable max-classes-per-file -- The private Client adapter belongs to this version-pinned transport. */
import { Client, Room, CloseCode } from '@colyseus/sdk'
import type { SeatReservation } from '@colyseus/sdk'
import { MultiplayerError } from './types'
import type { Reservation } from './protocol'

export interface NativeEvents {
    control(value: unknown): void
    syncControl(value: unknown): void
    relay(value: Uint8Array): void
    snapshot(value: Uint8Array): void
    closed(code: number): void
}

class PreparedClient extends Client {
    private prepare: (room: Room) => void

    constructor(endpoint: string, prepare: (room: Room) => void) {
        super(endpoint)
        this.prepare = prepare
    }

    protected createRoom<T>(name: string): Room<any, T> {
        const room = new Room<any, T>(name)
        this.prepare(room)
        return room
    }
}

/** Only this adapter knows native IDs and the version-pinned Colyseus API. */
export default class NativeConnection {
    private room?: Room

    private stopped = false

    private events: NativeEvents

    private cancelConnect?: () => void

    get token(): string | undefined {
        return this.room?.reconnectionToken?.split(':')[1]
    }

    get open(): boolean {
        return !this.stopped && Boolean(this.room?.connection?.isOpen)
    }

    get buffered(): number {
        // The pinned ws transport exposes its WebSocket. There is no application queue.
        const transport = this.room?.connection?.transport as { ws?: { bufferedAmount: number } } | undefined
        return transport?.ws?.bufferedAmount || 0
    }

    constructor(events: NativeEvents) {
        this.events = events
    }

    async connect(reservation: Reservation, endpoint: string, signal: AbortSignal, token?: string): Promise<void> {
        const client = new PreparedClient(endpoint, (room) => {
            this.room = room
            // Own the retry lifecycle: native's scheduled retry cannot be cancelled in 0.17.43.
            Object.assign(room.reconnection, { enabled: false, maxEnqueuedMessages: 0 })
            room.onMessage('control', (value: unknown) => { if (!this.stopped) this.events.control(value) })
            room.onMessage('sync_control', (value: unknown) => { if (!this.stopped) this.events.syncControl(value) })
            room.onMessage('relay', (value: Uint8Array) => { if (!this.stopped) this.events.relay(value) })
            room.onMessage('sync_state', (value: Uint8Array) => { if (!this.stopped) this.events.snapshot(value) })
            room.onLeave((code) => { if (!this.stopped) this.events.closed(code) })
        })
        const cancel = (): void => this.stop()
        signal.addEventListener('abort', cancel, { once: true })
        try {
            if (signal.aborted) throw new MultiplayerError('CANCELLED')
            const cancelled = new Promise<never>((_resolve, reject) => {
                this.cancelConnect = () => reject(new MultiplayerError('CANCELLED'))
            })
            const connected = client.consumeSeatReservation({
                ...reservation.colyseus,
                ...(token ? { reconnectionToken: token } : {}),
            } as SeatReservation)
            await Promise.race([connected, cancelled])
        } catch (error) {
            const code = terminalClose(Number((error as { code?: number })?.code))
            if (code) throw new MultiplayerError(code)
            throw error
        } finally {
            this.cancelConnect = undefined
            signal.removeEventListener('abort', cancel)
        }
    }

    send(channel: string, value: unknown): void {
        if (!this.open) throw new MultiplayerError('NOT_CONNECTED')
        this.room!.send(channel, value)
    }

    sendBytes(channel: string, bytes: Uint8Array): void {
        if (!this.open) throw new MultiplayerError('NOT_CONNECTED')
        this.room!.sendBytes(channel, bytes)
    }

    stop(): void {
        if (this.stopped) return
        this.stopped = true
        this.cancelConnect?.()
        if (this.room) {
            this.room.reconnection.enabled = false
            this.room.reconnection.enqueuedMessages.length = 0
            this.room.connection?.close()
            this.room.removeAllListeners()
        }
    }
}

export const terminalClose = (code: number): string | undefined => ({
    4401: 'REPLACED',
    4402: 'ROOM_ENDED',
    4403: 'UNAUTHORIZED',
    4420: 'PROTOCOL_VIOLATION',
} as Record<number, string>)[code]

export const needsRejoin = (code: number): boolean => code === 4410 || code === CloseCode.SERVER_SHUTDOWN
