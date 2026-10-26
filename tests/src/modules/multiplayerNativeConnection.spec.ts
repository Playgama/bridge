import {
    afterEach, beforeEach, expect, test, vi,
} from 'vitest'
import NativeConnection from '../../../src/modules/multiplayer/transport/NativeConnection'
import type { Reservation } from '../../../src/modules/multiplayer/transport/protocol'

let socket: { onmessage?: (event: { data: ArrayBuffer }) => void; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }
let native: NativeConnection
const events = { control: vi.fn(), syncControl: vi.fn(), relay: vi.fn(), snapshot: vi.fn(), closed: vi.fn() }
const reservation = { colyseus: { processId: 'process', roomId: 'room', sessionId: 'session' } } as Reservation
const receive = (bytes: number[]) => socket.onmessage!({ data: new Uint8Array(bytes).buffer })

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('WebSocket', vi.fn(() => {
        socket = { send: vi.fn(), close: vi.fn() }
        return socket
    }))
    native = new NativeConnection(events)
})
afterEach(() => { native.stop(); vi.unstubAllGlobals() })

// Colyseus ERROR = 11, schema uint16 = 0xcd, low byte first, then an empty message.
test.each([
    [[11, 0xcd, 0x31, 0x11, 0xa0], 'REPLACED'],
    [[11, 0xcd, 0x32, 0x11, 0xa0], 'ROOM_ENDED'],
    [[11, 0xcd, 0x33, 0x11, 0xa0], 'UNAUTHORIZED'],
    [[11, 0xcd, 0x44, 0x11, 0xa0], 'PROTOCOL_VIOLATION'],
    [[11, 0xcd, 0x34, 0x11, 0xa0], 'CONNECTION_LOST'],
    [[11, 0xcd, 0x31], 'CONNECTION_LOST'],
    // Unknown schema uint32 0x31110000 must not become terminal code 4401.
    [[11, 0xce, 0, 0, 0x11, 0x31, 0xa0], 'CONNECTION_LOST'],
] as [number[], string][])('maps ERROR frame %j to %s', async (bytes, code) => {
    const connected = native.connect(reservation, 'https://example.com/relay', new AbortController().signal)
    const rejected = expect(connected).rejects.toMatchObject({ code })
    receive(bytes)
    await rejected
})

test('ROOM_DATA still decodes ordinary big-endian MessagePack', async () => {
    const connected = native.connect(reservation, 'https://example.com/relay', new AbortController().signal)
    receive([10, 0]) // JOIN_ROOM, empty reconnection token
    await connected
    // ROOM_DATA, "control", { v: 4401 }; MessagePack uint16 is high byte first.
    receive([13, 0xa7, ...new TextEncoder().encode('control'), 0x81, 0xa1, 0x76, 0xcd, 0x11, 0x31])
    expect(events.control).toHaveBeenCalledWith({ v: 4401 })
})
