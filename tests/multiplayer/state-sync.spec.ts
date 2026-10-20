// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StateSync, { type SyncContext } from '../../src/modules/multiplayer/StateSync'
import { frame, unframe } from '../../src/modules/multiplayer/protocol'

function harness() {
    const context: SyncContext = {
        connected: true, roomId: 'room', playerId: 'self', ownerEpoch: '1', generation: 1,
        hostPlayerId: null, hostEpoch: '0', hostStatus: 'none', syncStarted: false,
    }
    const controls: any[] = []
    const packets: Uint8Array[] = []
    let world = { tick: 0 }
    const getState = vi.fn(() => world)
    const applyState = vi.fn((state: object) => { world = state as typeof world })
    const error = vi.fn()
    const rejoin = vi.fn()
    const sync = new StateSync({
        context: () => ({ ...context }),
        control: (message) => { controls.push(message); return true },
        bytes: (message) => { packets.push(message); return true },
        changed: vi.fn(), error, rejoin,
    }, { getState, applyState })
    sync.connected()
    const control = (fields: object) => sync.control({
        v: 1, roomId: 'room', ownerEpoch: context.ownerEpoch,
        registrationId: controls.filter((message) => message.kind === 'register').at(-1)?.registrationId,
        ...fields,
    })
    const role = (fields: Partial<SyncContext>) => { Object.assign(context, fields); sync.metadata() }
    const host = () => {
        control({ kind: 'registered' })
        role({ hostPlayerId: 'self', hostEpoch: '1', hostStatus: 'preparing' })
        vi.advanceTimersByTime(100)
    }
    const accept = () => {
        role({ hostStatus: 'active', syncStarted: true })
        control({ kind: 'state_accepted', hostEpoch: context.hostEpoch, seq: '1' })
    }
    return {
        sync, context, controls, packets, getState, applyState, error, rejoin, control, role, host, accept,
        snapshot: (seq: string, state: object) => sync.snapshot(frame({
            v: 1, roomId: 'room', ownerEpoch: context.ownerEpoch,
            hostEpoch: context.hostEpoch, seq, from: context.hostPlayerId,
        }, new TextEncoder().encode(JSON.stringify(state)))),
    }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('server-authorized state synchronization', () => {
    it('waits for registration and first snapshot ACK before granting host authority', () => {
        const h = harness()
        h.role({ hostPlayerId: 'self', hostEpoch: '1', hostStatus: 'preparing' })
        vi.advanceTimersByTime(500)
        expect(h.getState).not.toHaveBeenCalled()
        h.control({ kind: 'registered' })
        vi.advanceTimersByTime(100)
        expect(h.packets).toHaveLength(1)
        expect(h.sync.isHost).toBe(false)
        h.role({ hostStatus: 'active', syncStarted: true })
        expect(h.sync.isHost).toBe(false)
        h.control({ kind: 'state_accepted', hostEpoch: '1', seq: '1' })
        expect(h.sync.isHost).toBe(true)
        h.sync.dispose()
    })

    it('retries the first snapshot byte-for-byte, without recapturing mutated game state', () => {
        const h = harness()
        h.host()
        h.getState.mockReturnValue({ tick: 999 })
        vi.advanceTimersByTime(1000)
        expect(h.packets).toHaveLength(2)
        expect(h.packets[1]).toEqual(h.packets[0])
        expect(h.getState).toHaveBeenCalledTimes(1)
        h.accept()
        vi.advanceTimersByTime(100)
        expect(unframe(h.packets[2]).header.seq).toBe('2')
        h.sync.dispose()
    })

    it.each(['STALE_HOST', 'RATE_LIMITED', 'HOST_PREPARATION_TIMEOUT', 'INVALID_REQUEST'])(
        'ignores delayed %s from an old host assignment before first new ACK and after activation',
        (code) => {
            const h = harness()
            h.host()
            h.accept()
            h.role({ hostEpoch: '2', hostStatus: 'preparing' })
            h.control({ kind: 'error', code, requestHostEpoch: '1', retryAfterMs: 60000 })
            vi.advanceTimersByTime(100)
            expect(unframe(h.packets.at(-1)!).header.hostEpoch).toBe('2')
            expect(h.error).not.toHaveBeenCalled()
            h.accept()
            expect(h.sync.isHost).toBe(true)
            h.control({ kind: 'error', code, requestHostEpoch: '1', retryAfterMs: 60000 })
            expect(h.sync.isHost).toBe(true)
            expect(h.rejoin).not.toHaveBeenCalled()
            h.sync.dispose()
        },
    )

    it('current STALE_HOST pauses and repeated same metadata resumes without resetting seq or rejoining', () => {
        const h = harness()
        h.host()
        h.accept()
        h.control({ kind: 'error', code: 'STALE_HOST', requestHostEpoch: '1' })
        expect(h.sync.isHost).toBe(false)
        vi.advanceTimersByTime(200)
        expect(h.packets).toHaveLength(1)
        h.role({})
        expect(h.sync.isHost).toBe(true)
        vi.advanceTimersByTime(100)
        expect(unframe(h.packets.at(-1)!).header.seq).toBe('2')
        expect(h.rejoin).not.toHaveBeenCalled()
        h.sync.dispose()
    })

    it('applies non-host snapshots once and preserves an immutable retained copy for promotion', () => {
        const h = harness()
        h.control({ kind: 'registered' })
        h.role({ hostPlayerId: 'other', hostEpoch: '1', hostStatus: 'active', syncStarted: true })
        const appliedTicks: number[] = []
        h.applyState.mockImplementation((state) => {
            appliedTicks.push((state as { tick: number }).tick)
            ;(state as { tick: number }).tick = 999
        })
        h.snapshot('1', { tick: 7 })
        h.snapshot('1', { tick: 8 })
        expect(h.applyState).toHaveBeenCalledTimes(1)
        expect(h.sync.isReady).toBe(true)
        h.role({ hostPlayerId: 'self', hostEpoch: '2', hostStatus: 'preparing' })
        vi.advanceTimersByTime(100)
        expect(appliedTicks).toEqual([7, 7])
        h.sync.dispose()
    })

    it('resets both gates immediately on waiting, disconnect and disposal', () => {
        const h = harness()
        h.host()
        h.accept()
        h.role({ hostStatus: 'waiting' })
        expect(h.sync.isReady).toBe(false)
        expect(h.sync.isHost).toBe(false)
        h.control({ kind: 'state_accepted', hostEpoch: '1', seq: '1' })
        expect(h.sync.isReady).toBe(false)
        h.sync.disconnected()
        const count = h.packets.length
        vi.advanceTimersByTime(10000)
        expect(h.packets).toHaveLength(count)
        h.sync.dispose()
    })

    it('retains bytes before applyState can mutate the original frame', () => {
        const h = harness()
        h.control({ kind: 'registered' })
        h.role({ hostPlayerId: 'other', hostEpoch: '1', hostStatus: 'active', syncStarted: true })
        const packet = frame({
            v: 1, roomId: 'room', ownerEpoch: '1', hostEpoch: '1', seq: '1', from: 'other',
        }, new TextEncoder().encode('{"tick":7}'))
        const ticks: number[] = []
        h.applyState.mockImplementation((state) => {
            ticks.push((state as { tick: number }).tick)
            packet.fill(0)
        })
        h.sync.snapshot(packet)
        h.role({ hostPlayerId: 'self', hostEpoch: '2', hostStatus: 'preparing' })
        vi.advanceTimersByTime(100)
        expect(ticks).toEqual([7, 7])
        expect(h.error).not.toHaveBeenCalled()
        h.sync.dispose()
    })

    it.each([
        new TextEncoder().encode('null'),
        new TextEncoder().encode('[]'),
        new TextEncoder().encode('{"a":1e999}'),
        new TextEncoder().encode(`{"a":${'['.repeat(65)}0${']'.repeat(65)}}`),
        new TextEncoder().encode(`{"a":"${'x'.repeat(65536)}"}`),
        new Uint8Array([123, 34, 97, 34, 58, 34, 255, 34, 125]),
    ])('rejects invalid incoming JSON before invoking applyState %#', (payload) => {
        const h = harness()
        h.control({ kind: 'registered' })
        h.role({ hostPlayerId: 'other', hostEpoch: '1', hostStatus: 'active', syncStarted: true })
        const prefix = frame({
            v: 1, roomId: 'room', ownerEpoch: '1', hostEpoch: '1', seq: '1', from: 'other',
        }, new Uint8Array())
        const packet = new Uint8Array(prefix.length + payload.length)
        packet.set(prefix)
        packet.set(payload, prefix.length)
        h.sync.snapshot(packet)
        expect(h.applyState).not.toHaveBeenCalled()
        expect(h.error).toHaveBeenCalledTimes(1)
        expect(h.sync.isReady).toBe(false)
        h.sync.dispose()
    })

    it('does not create a new world after syncStarted without retained state', () => {
        const h = harness()
        h.control({ kind: 'registered' })
        h.role({ hostPlayerId: 'self', hostEpoch: '2', hostStatus: 'preparing', syncStarted: true })
        vi.advanceTimersByTime(4000)
        expect(h.getState).not.toHaveBeenCalled()
        expect(h.sync.isReady).toBe(false)
        h.sync.dispose()
    })

    it.each([
        ['throw', () => { throw new Error('game error') }],
        ['promise', () => Promise.resolve({ tick: 1 })],
        ['invalid', () => ({ tick: Infinity })],
        ['oversize', () => ({ text: 'x'.repeat(65536) })],
    ])('terminally stops a %s callback and unregisters', (_label, callback) => {
        const h = harness()
        h.getState.mockImplementation(callback as () => { tick: number })
        h.host()
        expect(h.error).toHaveBeenCalledTimes(1)
        expect(h.sync.isHost).toBe(false)
        expect(h.sync.isReady).toBe(false)
        expect(h.controls.at(-1).kind).toBe('unregister')
        vi.advanceTimersByTime(4000)
        expect(h.error).toHaveBeenCalledTimes(1)
        h.sync.dispose()
    })

    it('fences authority changed synchronously inside getState', () => {
        const h = harness()
        h.getState.mockImplementation(() => {
            h.role({ hostStatus: 'waiting' })
            return { tick: 1 }
        })
        h.host()
        expect(h.packets).toHaveLength(0)
        h.sync.dispose()
    })

    it('rejects wrong registration and owner responses without changing role', () => {
        const h = harness()
        h.host()
        h.accept()
        h.control({ kind: 'error', code: 'INVALID_REQUEST', requestHostEpoch: null, registrationId: 'old' })
        h.control({ kind: 'error', code: 'INVALID_REQUEST', requestHostEpoch: null, ownerEpoch: '0' })
        expect(h.sync.isHost).toBe(true)
        h.sync.dispose()
    })

    it('does not resurrect a timer when retained applyState disposes during reconnect', () => {
        const h = harness()
        h.control({ kind: 'registered' })
        h.role({ hostPlayerId: 'other', hostEpoch: '1', hostStatus: 'active', syncStarted: true })
        h.snapshot('1', { tick: 7 })
        h.sync.disconnected()
        h.context.generation += 1
        h.applyState.mockImplementation(() => {
            h.context.connected = false
            h.sync.dispose()
        })
        h.sync.connected()
        expect(vi.getTimerCount()).toBe(0)
        const controls = h.controls.length
        vi.advanceTimersByTime(10000)
        expect(h.controls).toHaveLength(controls)
    })

    it('does not resurrect a timer when the metadata state observer disposes', () => {
        const context: SyncContext = {
            connected: true, roomId: 'room', playerId: 'self', ownerEpoch: '1', generation: 1,
            hostPlayerId: null, hostEpoch: '0', hostStatus: 'none', syncStarted: false,
        }
        let notifications = 0
        const sync = new StateSync({
            context: () => context, control: () => true, bytes: () => true, error: vi.fn(), rejoin: vi.fn(),
            changed: () => {
                notifications += 1
                if (notifications === 2) { context.connected = false; sync.dispose() }
            },
        }, { getState: () => ({}), applyState: () => {} })
        sync.connected()
        expect(vi.getTimerCount()).toBe(0)
    })
})
