import { MultiplayerError } from './types'
import { decodeMsgpack, encodeMsgpack } from './msgpack'
import { ROOM_CLOSE_CODE, ROOM_FRAME } from './protocol'
import type { Reservation } from './protocol'

export interface NativeEvents {
    control(value: unknown): void
    syncControl(value: unknown): void
    relay(value: Uint8Array): void
    snapshot(value: Uint8Array): void
    closed(code: number): void
}

export const terminalClose = (code: number): string | undefined => ({
    [ROOM_CLOSE_CODE.REPLACED]: 'REPLACED',
    [ROOM_CLOSE_CODE.ROOM_ENDED]: 'ROOM_ENDED',
    [ROOM_CLOSE_CODE.UNAUTHORIZED]: 'UNAUTHORIZED',
    [ROOM_CLOSE_CODE.PROTOCOL_VIOLATION]: 'PROTOCOL_VIOLATION',
} as Record<number, string>)[code]

export const needsRejoin = (code: number): boolean => code === ROOM_CLOSE_CODE.REJOIN
    || code === ROOM_CLOSE_CODE.SERVER_SHUTDOWN

function frame(code: number, type: string, payload: Uint8Array): Uint8Array {
    const header = encodeMsgpack(type)
    const result = new Uint8Array(1 + header.length + payload.length)
    result[0] = code
    result.set(header, 1)
    result.set(payload, 1 + header.length)
    return result
}

function roomUrl(reservation: Reservation, endpoint: string, token?: string): string {
    const {
        publicAddress, processId, roomId, sessionId, reconnectionToken,
    } = reservation.colyseus
    const api = new URL(endpoint)
    const address = publicAddress || `${api.host}${api.pathname.replace(/\/$/, '')}`
    const query = new URLSearchParams({ sessionId })
    const rejoinToken = token ?? (typeof reconnectionToken === 'string' ? reconnectionToken : '')
    if (rejoinToken) query.set('reconnectionToken', rejoinToken)
    return `${api.protocol === 'https:' ? 'wss' : 'ws'}://${address}/${processId}/${roomId}?${query}`
}

/**
 * WebSocket to the room server. Speaks the frames of the Colyseus wire protocol a relay room
 * uses: join with a seat reservation, messages and byte messages. Rooms have no Colyseus state.
 */
export default class NativeConnection {
    get token(): string | undefined {
        return this.reconnectionToken
    }

    get open(): boolean {
        return !this.stopped && this.socket?.readyState === WebSocket.OPEN
    }

    get buffered(): number {
        return this.socket?.bufferedAmount || 0
    }

    private socket?: WebSocket

    private stopped = false

    private joined = false

    private events: NativeEvents

    private reconnectionToken?: string

    private join?: { resolve(): void; reject(error: MultiplayerError): void }

    // A network switch leaves the socket hanging: close it right away so the room reconnects.
    private offline = (): void => this.drop(ROOM_CLOSE_CODE.MAY_TRY_RECONNECT)

    constructor(events: NativeEvents) {
        this.events = events
    }

    async connect(reservation: Reservation, endpoint: string, signal: AbortSignal, token?: string): Promise<void> {
        if (signal.aborted) throw new MultiplayerError('CANCELLED')
        const cancel = (): void => this.stop()
        signal.addEventListener('abort', cancel, { once: true })
        try {
            await new Promise<void>((resolve, reject) => {
                this.join = { resolve, reject }
                const socket = new WebSocket(roomUrl(reservation, endpoint, token))
                socket.binaryType = 'arraybuffer'
                socket.onopen = () => window.addEventListener('offline', this.offline)
                socket.onmessage = (event) => this.receive(new Uint8Array(event.data as ArrayBuffer))
                socket.onclose = (event) => this.closed(event.code)
                socket.onerror = () => this.fail(NaN)
                this.socket = socket
            })
        } finally {
            this.join = undefined
            signal.removeEventListener('abort', cancel)
        }
    }

    send(channel: string, value: unknown): void {
        this.write(frame(ROOM_FRAME.ROOM_DATA, channel, encodeMsgpack(value)))
    }

    sendBytes(channel: string, bytes: Uint8Array): void {
        this.write(frame(ROOM_FRAME.ROOM_DATA_BYTES, channel, bytes))
    }

    stop(): void {
        if (this.stopped) return
        this.stopped = true
        window.removeEventListener('offline', this.offline)
        this.join?.reject(new MultiplayerError('CANCELLED'))
        this.socket?.close()
    }

    private write(data: Uint8Array): void {
        if (!this.open) throw new MultiplayerError('NOT_CONNECTED')
        this.socket!.send(data)
    }

    private receive(data: Uint8Array): void {
        if (this.stopped) return
        switch (data[0]) {
            case ROOM_FRAME.JOIN_ROOM: {
                // Reconnection token and serializer id, each prefixed by its byte length
                const length = data[1]
                this.reconnectionToken = new TextDecoder().decode(data.subarray(2, 2 + length))
                this.socket!.send(new Uint8Array([ROOM_FRAME.JOIN_ROOM]))
                this.joined = true
                this.join?.resolve()
                break
            }
            case ROOM_FRAME.ERROR:
                this.fail(Number(decodeMsgpack(data, 1).value))
                break
            case ROOM_FRAME.LEAVE_ROOM:
                // The server asks to leave: confirm, then it closes the socket
                this.socket!.send(new Uint8Array([ROOM_FRAME.LEAVE_ROOM]))
                break
            case ROOM_FRAME.ROOM_DATA: {
                const type = decodeMsgpack(data, 1)
                const value = type.offset < data.length ? decodeMsgpack(data, type.offset).value : undefined
                this.dispatch(type.value, value)
                break
            }
            case ROOM_FRAME.ROOM_DATA_BYTES: {
                const type = decodeMsgpack(data, 1)
                this.dispatch(type.value, data.subarray(type.offset))
                break
            }
            default:
                break
        }
    }

    private dispatch(type: unknown, value: unknown): void {
        switch (type) {
            case 'control':
                this.events.control(value)
                break
            case 'sync_control':
                this.events.syncControl(value)
                break
            case 'relay':
                this.events.relay(value as Uint8Array)
                break
            case 'sync_state':
                this.events.snapshot(value as Uint8Array)
                break
            default:
                break
        }
    }

    // Errors and closes before the join reject connect(); after it only a close counts.
    private fail(code: number): void {
        if (!this.joined) this.join?.reject(new MultiplayerError(terminalClose(code) ?? 'CONNECTION_LOST'))
    }

    private closed(code: number): void {
        window.removeEventListener('offline', this.offline)
        if (this.stopped) return
        if (this.joined) this.events.closed(code)
        else this.fail(code)
    }

    private drop(code: number): void {
        if (!this.socket) return
        this.socket.onclose = null
        this.closed(code)
        this.socket.close(code)
    }
}
