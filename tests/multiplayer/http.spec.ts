// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HttpClient from '../../src/modules/multiplayer/HttpClient'
import { invitation, encodeJson, frame, unframe } from '../../src/modules/multiplayer/protocol'

const config = { apiBase: 'http://localhost:3000/api/bridge/v1/relay', appToken: 'public-game-a', environment: 'test' }
const session = (region = 'eu', token = 'session-a') => ({
    sessionId: token, sessionToken: token, region, protocolVersion: 1,
    apiBase: `${config.apiBase}/regions/${region}`, expiresAt: new Date(Date.now() + 86400000).toISOString(),
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

beforeEach(() => {
    vi.useFakeTimers()
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
    })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('session scope and HTTP retry identity', () => {
    it('single-flights parallel ordinary sessions and retains the selected region', async () => {
        const fetch = vi.fn().mockResolvedValue(json(session()))
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({ 'x-platform-id': 'standalone' }))
        const [first, second] = await Promise.all([http.session(), http.session()])
        expect(first).toBe(second)
        expect(await http.session()).toBe(first)
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch.mock.calls[0][1].credentials).toBe('omit')
    })

    it('atomically chooses one session when default and invitation resolve to the same region', async () => {
        let completeDefault!: (value: Response) => void
        const fetch = vi.fn()
            .mockImplementationOnce(() => new Promise((resolve) => { completeDefault = resolve }))
            .mockResolvedValueOnce(json(session('eu', 'invite')))
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({}))
        const ordinary = http.session()
        const invite = await http.session('eu')
        completeDefault(json(session('eu', 'ordinary')))
        expect(await ordinary).toBe(invite)
    })

    it('separates game, environment and regional storage scopes', async () => {
        const fetch = vi.fn().mockImplementation((_url, options) => json(session(JSON.parse(options.body).region || 'eu')))
        vi.stubGlobal('fetch', fetch)
        await new HttpClient(config, () => ({})).session('eu')
        await new HttpClient(config, () => ({})).session('eu')
        expect(fetch).toHaveBeenCalledTimes(1)
        await new HttpClient({ ...config, appToken: 'game-b' }, () => ({})).session('eu')
        await new HttpClient({ ...config, environment: 'different' }, () => ({})).session('eu')
        await new HttpClient(config, () => ({})).session('us')
        expect(fetch).toHaveBeenCalledTimes(4)
    })

    it('replays the same endpoint, session, body and key across network loss and pending', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(json(session()))
            .mockRejectedValueOnce(new TypeError('lost reply'))
            .mockResolvedValueOnce(json({ status: 'pending', retryAfterMs: 1200 }, 202))
            .mockResolvedValueOnce(json({ status: 'admitted', roomId: 'r', playerId: 'p' }))
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({}))
        const identity = await http.session()
        const body = { player: { name: 'original' } }
        const result = http.request('/rooms/create', body, identity, 'stable-key')
        body.player.name = 'mutated'
        await vi.advanceTimersByTimeAsync(5000)
        expect(await result).toMatchObject({ status: 'admitted' })
        const requests = fetch.mock.calls.slice(1)
        expect(requests).toHaveLength(3)
        requests.forEach(([url, options]) => {
            expect(url).toBe(`${identity.apiBase}/rooms/create`)
            expect(options.headers['Idempotency-Key']).toBe('stable-key')
            expect(options.headers.Authorization).toBe('Bearer session-a')
            expect(options.body).toBe('{"player":{"name":"original"}}')
        })
    })

    it('does not replace an expired handle session during a retry', async () => {
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({}))
        const expired = { ...session(), region: 'eu' as const, protocolVersion: 1 as const, expiresAt: '2000-01-01T00:00:00Z' }
        await expect(http.request('/rooms/rejoin', { roomId: 'r' }, expired, 'key')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
        expect(fetch).not.toHaveBeenCalled()
    })

    it.each(['86400', 'Wed, 01 Jan 2099 00:00:00 GMT'])('bounds Retry-After %s by the supplied deadline', async (header) => {
        const fetch = vi.fn().mockResolvedValue(new Response('{"status":"pending"}', {
            status: 202, headers: { 'Retry-After': header },
        }))
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({}))
        const result = expect(http.request('/rooms/create', {}, undefined, 'key', undefined, Date.now() + 2000))
            .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' })
        await vi.advanceTimersByTimeAsync(2000)
        await result
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('aborts in-flight fetch at the remaining deadline instead of starting another ten seconds', async () => {
        let aborted = false
        vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) })
        })))
        const result = expect(new HttpClient(config, () => ({}))
            .request('/rooms/create', {}, undefined, 'key', undefined, Date.now() + 2000))
            .rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' })
        await vi.advanceTimersByTimeAsync(2000)
        await result
        expect(aborted).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('cancels a pending HTTP retry immediately without another request', async () => {
        const fetch = vi.fn().mockResolvedValue(json({ status: 'pending', retryAfterMs: 86400000 }, 202))
        vi.stubGlobal('fetch', fetch)
        const controller = new AbortController()
        const result = expect(new HttpClient(config, () => ({}))
            .request('/rooms/rejoin', {}, undefined, 'key', controller.signal))
            .rejects.toMatchObject({ code: 'CANCELLED' })
        await vi.advanceTimersByTimeAsync(1)
        controller.abort()
        await result
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('rejects a regional base outside the configured environment before sending its token', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...session(), apiBase: 'https://playgama.com/api/bridge/v1/relay/regions/eu' })))
        await expect(new HttpClient(config, () => ({})).session()).rejects.toMatchObject({ code: 'PROTOCOL_VIOLATION' })
    })

    it('retries scheduled refresh after a transient outage without replacing session identity', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(json(session()))
        vi.stubGlobal('fetch', fetch)
        const http = new HttpClient(config, () => ({}))
        const identity = await http.session()
        fetch.mockRejectedValue(new TypeError('offline'))
        await vi.advanceTimersByTimeAsync(12 * 3600 * 1000 + 140000)
        const attempts = fetch.mock.calls.length
        fetch.mockImplementation(() => Promise.resolve(json({
            sessionId: identity.sessionId, expiresAt: new Date(Date.now() + 86400000).toISOString(),
        })))
        await vi.advanceTimersByTimeAsync(60000)
        expect(fetch.mock.calls.length).toBeGreaterThan(attempts)
        expect(await http.session()).toBe(identity)
        expect(fetch.mock.calls.at(-1)?.[1].headers.Authorization).toBe('Bearer session-a')
    })
})

describe('binary protocol', () => {
    it('routes and normalizes eight-character invitations only', () => {
        expect(invitation(' \t k7m4x9tr\r\n')).toEqual({ code: 'K7M4X9TR', region: 'eu' })
        expect(() => invitation('K7M4O9TR')).toThrow()
        expect(() => invitation('K7M4-9TR')).toThrow()
        expect(() => invitation('\u00a0K7M4X9TR')).toThrow()
    })
    it('uses big-endian length and arbitrary binary payload without losing byte offsets', () => {
        const packet = frame({ v: 1, type: 'input', to: 'others' }, new Uint8Array([0, 255, 128]))
        const wrapped = new Uint8Array(packet.length + 10)
        wrapped.set(packet, 5)
        expect(unframe(wrapped.subarray(5, 5 + packet.length))).toEqual({
            header: { v: 1, type: 'input', to: 'others' }, payload: new Uint8Array([0, 255, 128]),
        })
    })
    it.each([undefined, { a: undefined }, { a: NaN }, { a: 1n }, new Date(), { a: () => 1 }])(
        'does not silently omit invalid JSON %#', (value) => expect(() => encodeJson(value, true)).toThrow(),
    )
})
