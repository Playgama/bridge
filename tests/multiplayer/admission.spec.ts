// @vitest-environment node
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { admit } from '../../src/modules/multiplayer/admission'
import type HttpClient from '../../src/modules/multiplayer/HttpClient'
import type { Session } from '../../src/modules/multiplayer/protocol'
import { MultiplayerError } from '../../src/modules/multiplayer/types'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('keeps the grant retry key, rotating it only for admitted-to-rejoin', async () => {
    const grant = { status: 'grant', reservation: { roomId: 'room' } }
    const request = vi.fn().mockResolvedValueOnce(grant)
        .mockResolvedValueOnce({ status: 'admitted', roomId: 'room' })
        .mockResolvedValue(grant)
    const connect = vi.fn().mockRejectedValueOnce(new Error('lost welcome')).mockResolvedValue('handle')
    const deadline = Date.now() + 120000
    const result = admit({
        http: { request } as unknown as HttpClient, session: {} as Session,
        path: '/rooms/create', body: { player: { name: 'a' } }, deadline, connect,
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(await result).toBe('handle')
    const calls = request.mock.calls
    expect(calls).toHaveLength(3)
    expect(calls[0][3]).toBe(calls[1][3])
    expect(calls[2][3]).not.toBe(calls[0][3])
    expect(calls[2][0]).toBe('/rooms/rejoin')
    expect(calls[2][1]).toEqual({ roomId: 'room' })
    expect(calls.map((call) => call[5])).toEqual([deadline, deadline, deadline])
})

it.each(['CANCELLED', 'REPLACED', 'ROOM_ENDED', 'UNAUTHORIZED', 'PROTOCOL_VIOLATION'])(
    'does not retry terminal connection error %s', async (code) => {
        const request = vi.fn().mockResolvedValue({ status: 'grant', reservation: { roomId: 'room' } })
        await expect(admit({
            http: { request } as unknown as HttpClient, session: {} as Session,
            path: '/rooms/rejoin', body: { roomId: 'room' }, deadline: Date.now() + 120000,
            connect: async () => { throw new MultiplayerError(code) },
        })).rejects.toMatchObject({ code })
        expect(request).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    },
)

it('bounds repeated grant retries by one deadline', async () => {
    const request = vi.fn().mockResolvedValue({ status: 'grant', reservation: { roomId: 'room' } })
    const deadline = Date.now() + 2500
    const result = expect(admit({
        http: { request } as unknown as HttpClient, session: {} as Session,
        path: '/rooms/rejoin', body: { roomId: 'room' }, deadline,
        connect: async () => { throw new Error('seat expired') },
    })).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(2500)
    await result
    expect(new Set(request.mock.calls.map((call) => call[3])).size).toBe(1)
    expect(request.mock.calls.every((call) => call[5] === deadline)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
})
