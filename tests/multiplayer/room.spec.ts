// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RoomHandle from '../../src/modules/multiplayer/RoomHandle'
import type HttpClient from '../../src/modules/multiplayer/HttpClient'
import type { Session, Reservation } from '../../src/modules/multiplayer/protocol'
import { frame } from '../../src/modules/multiplayer/protocol'

const fake = vi.hoisted(() => ({ instances: [] as any[], welcome: true }))
vi.mock('../../src/modules/multiplayer/NativeConnection', () => ({
    default: class {
        open = true
        buffered = 0
        token = 'native-token'
        sent: any[] = []
        stopped = false
        events: any
        connectArgs: any[] = []
        constructor(events: any) { this.events = events; fake.instances.push(this) }
        async connect(reservation: Reservation, ...args: any[]) {
            this.connectArgs = args
            if (fake.welcome) this.events.control({
                v: 1, event: 'welcome', payload: {
                    roomId: reservation.roomId, selfPlayerId: reservation.playerId,
                    ownerEpoch: reservation.ownerEpoch, connectionGeneration: reservation.connectionGeneration,
                    revision: '1', inviteCode: 'K7M4X9TR',
                    room: {
                        id: reservation.roomId, region: 'eu', creatorId: reservation.playerId, gameVersion: 'default',
                        maxPlayers: 4, isOpen: true, isVisible: false, properties: {},
                        hostPlayerId: null, hostEpoch: '0', hostStatus: 'none', syncStarted: false,
                    },
                    players: [{ id: reservation.playerId, name: 'A', properties: {} }],
                },
            })
        }
        send(channel: string, value: any) { this.sent.push({ channel, value }) }
        sendBytes(channel: string, value: any) { this.sent.push({ channel, value }) }
        stop() { this.stopped = true; this.open = false }
    },
    terminalClose: (code: number) => ({ 4401: 'REPLACED', 4402: 'ROOM_ENDED', 4403: 'UNAUTHORIZED', 4420: 'PROTOCOL_VIOLATION' })[code],
    needsRejoin: (code: number) => code === 4410,
}))

const reservation: Reservation = {
    roomId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', playerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    region: 'eu', ownerEpoch: '1', connectionGeneration: '1',
    expiresAt: '2099-01-01T00:00:00Z',
    colyseus: { name: 'relay', roomId: 'native', processId: 'process', sessionId: 'seat', publicAddress: 'localhost:2567/api/multiplayer/ws' },
}
const session: Session = {
    sessionId: 'session', sessionToken: 'token', expiresAt: '2099-01-01T00:00:00Z',
    region: 'eu', apiBase: 'http://localhost:3000/api/bridge/v1/relay/regions/eu', protocolVersion: 1,
}

async function connected() {
    const request = vi.fn().mockResolvedValue({ status: 'grant', reservation: { ...reservation, ownerEpoch: '2', connectionGeneration: '2' } })
    const removed = vi.fn()
    const room = new RoomHandle({ request } as unknown as HttpClient, session, removed)
    await room.connect(reservation)
    const native = fake.instances.at(-1)
    const control = (event: string, fields: object) => native.events.control({
        v: 1, event, payload: { roomId: room.id, ownerEpoch: '1', revision: '1', ...fields },
    })
    return { room, native, control, request, removed }
}

beforeEach(() => {
    fake.instances.length = 0
    fake.welcome = true
    vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

describe('room lifecycle with an injected transport (not E2E)', () => {
    it('does not lose a welcome delivered synchronously by connect and replays current observer state', async () => {
        const { room } = await connected()
        const states = vi.fn()
        const players = vi.fn()
        room.onStateChange(states)
        room.onPlayersChange(players)
        expect(states).toHaveBeenCalledWith({ connectionState: 'connected', isReady: true, isHost: false, syncState: 'ready' })
        expect(players.mock.calls[0][0][0].id).toBe(room.playerId)
        expect(room.inviteCode).toBe('K7M4X9TR')
        room.abandon()
    })

    it('correlates ack at equal revision and never updates metadata optimistically', async () => {
        const { room, native, control } = await connected()
        const result = room.setRoom({ properties: { map: 'a' } })
        expect(room.properties).toEqual({})
        const command = native.sent[0].value
        control('ack', { requestId: command.requestId })
        await result
        room.abandon()
    })

    it('retries control with the same requestId and new owner epoch only after a replacement welcome', async () => {
        const { room, native, control, request } = await connected()
        const result = room.setPlayer({ score: 4 })
        const old = native.sent[0].value
        control('error', { requestId: old.requestId, code: 'STALE_EPOCH' })
        expect(room.connectionState).toBe('reconnecting')
        await vi.advanceTimersByTimeAsync(2200)
        expect(request).toHaveBeenCalledWith('/rooms/rejoin', { roomId: room.id }, session, expect.any(String), expect.any(AbortSignal))
        const next = fake.instances.at(-1)
        const replay = next.sent.find((item: any) => item.channel === 'control').value
        expect(replay.requestId).toBe(old.requestId)
        expect(replay.payload.ownerEpoch).toBe('2')
        next.events.control({ v: 1, event: 'ack', payload: {
            roomId: room.id, ownerEpoch: '2', revision: '1', requestId: old.requestId,
        } })
        await result
        room.abandon()
    })

    it('retains subscriptions but ignores old native callbacks and does not replay gameplay', async () => {
        const { room, native } = await connected()
        const received = vi.fn()
        room.onMessage(received)
        room.send('move', { x: 1 })
        native.events.closed(1006)
        expect(() => room.send('move', { x: 2 })).toThrow()
        await vi.advanceTimersByTimeAsync(1000)
        const current = fake.instances.at(-1)
        expect(current).not.toBe(native)
        expect(current.connectArgs.at(-1)).toBe('native-token')
        expect(current.sent).toHaveLength(0)
        const packet = frame({ v: 1, type: 'move', from: room.playerId, ownerEpoch: '1' }, new TextEncoder().encode('{"x":3}'))
        native.events.relay(packet)
        expect(received).not.toHaveBeenCalled()
        current.events.relay(packet)
        expect(received).toHaveBeenCalledTimes(1)
        room.abandon()
    })

    it.each([4401, 4402, 4403, 4420])('stops permanently on terminal close %i', async (code) => {
        const { room, native, request } = await connected()
        const errors = vi.fn()
        room.onError(errors)
        native.events.closed(code)
        await vi.advanceTimersByTimeAsync(30000)
        expect(errors).toHaveBeenCalledTimes(1)
        expect(room.connectionState).toBe('disconnected')
        expect(request).not.toHaveBeenCalled()
        expect(fake.instances).toHaveLength(1)
    })

    it('leave cancels a pending recovery before HTTP and never resurrects a native socket', async () => {
        const { room, native, request } = await connected()
        native.events.closed(1006)
        await room.leave()
        await vi.advanceTimersByTimeAsync(30000)
        expect(room.connectionState).toBe('disconnected')
        expect(request.mock.calls.map((call) => call[0])).toEqual(['/rooms/leave'])
        expect(fake.instances).toHaveLength(1)
    })

    it('closes healthy WSS immediately during HTTP leave outage and coalesces repeated leave', async () => {
        const { room, native, request } = await connected()
        let confirm!: (value: object) => void
        request.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve }))
        const first = room.leave()
        const second = room.leave()
        expect(second).toBe(first)
        expect(native.stopped).toBe(true)
        expect(room.connectionState).toBe('disconnected')
        expect(vi.getTimerCount()).toBe(0)
        expect(request.mock.calls[0][4]).toBeUndefined() // leave does not use the cancelled recovery signal
        native.events.closed(1006)
        await vi.advanceTimersByTimeAsync(30000)
        expect(fake.instances).toHaveLength(1)
        confirm({ left: true })
        await first
    })

    it('does not recreate control timers when a welcome observer leaves during reconnect', async () => {
        const { room, native } = await connected()
        let reconnecting = false
        room.onStateChange((state) => {
            if (state.connectionState === 'reconnecting') reconnecting = true
            if (state.connectionState === 'connected' && reconnecting) room.leave()
        })
        native.events.closed(1006)
        await vi.advanceTimersByTimeAsync(1000)
        expect(room.connectionState).toBe('disconnected')
        expect(vi.getTimerCount()).toBe(0)
    })

    it('shares one leave promise and HTTP operation when state observers call leave reentrantly', async () => {
        const { room, request } = await connected()
        let observed: Promise<void> | undefined
        room.onStateChange((state) => {
            if (state.connectionState === 'disconnected') observed = room.leave()
        })
        const leaving = room.leave()
        expect(observed).toBe(leaving)
        await leaving
        expect(request).toHaveBeenCalledTimes(1)
    })

    it('reports terminal sync failure once to existing and late error subscribers', async () => {
        const { room, native, control } = await connected()
        const early = vi.fn()
        room.onError(early)
        room.syncState({ getState: () => { throw new Error('bad game') }, applyState: () => {} })
        const registrationId = native.sent.find((item: any) => item.channel === 'sync_control').value.registrationId
        native.events.syncControl({ v: 1, kind: 'registered', roomId: room.id, ownerEpoch: '1', registrationId })
        control('host_changed', { hostPlayerId: room.playerId, hostEpoch: '1', hostStatus: 'preparing', syncStarted: false })
        await vi.advanceTimersByTimeAsync(100)
        const late = vi.fn()
        room.onError(late)
        expect(early).toHaveBeenCalledTimes(1)
        expect(late).toHaveBeenCalledTimes(1)
        expect(late.mock.calls[0][0].code).toBe('SYNC_CALLBACK_FAILED')
        expect(room.isReady).toBe(false)
        expect(() => room.syncState({ getState: () => ({}), applyState: () => {} })).toThrow()
        room.abandon()
    })
})
