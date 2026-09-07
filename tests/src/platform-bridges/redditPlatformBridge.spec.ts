import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import RedditPlatformBridge from '../../../src/platform-bridges/RedditPlatformBridge'
import { LEADERBOARD_TYPE } from '../../../src/modules/leaderboards/constants'

vi.stubGlobal('PLUGIN_VERSION', 'test-version')

type FetchCall = { url: string, method: string, body: unknown }

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(data: unknown, status = 200) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(data === undefined ? '' : JSON.stringify(data)),
    })
}

function lastCall(): FetchCall {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
    return {
        url,
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(init.body as string) : undefined,
    }
}

const AUTHORIZED_PLAYER = {
    isPlayerAuthorized: true,
    playerId: 't2_abc',
    playerName: 'snoo',
    playerPhoto: 'https://i.redd.it/snoo.png',
}

async function createInitializedBridge(payload: Record<string, unknown> = AUTHORIZED_PLAYER) {
    fetchMock.mockReturnValueOnce(jsonResponse(payload))
    const bridge = new RedditPlatformBridge()
    await bridge.initialize()
    return bridge
}

// Pins the HTTP contract between the bridge and the Devvit server template
// (`bridge-reddit-devvit`). The endpoint paths and body shapes are the
// protocol: changing them must break this test.
describe('RedditPlatformBridge server contract', () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    test('initialize reads the player from /api/initialize', async () => {
        const bridge = await createInitializedBridge()

        expect(lastCall()).toEqual({ url: '/api/initialize', method: 'GET', body: undefined })
        expect(bridge.isPlayerAuthorized).toBe(true)
        expect(bridge.playerId).toBe('t2_abc')
        expect(bridge.playerName).toBe('snoo')
        expect(bridge.playerPhotos).toEqual(['https://i.redd.it/snoo.png'])
        expect(bridge.isPlatformStorageAvailable).toBe(true)
    })

    test('initialize keeps the guest player when not authorized', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })

        expect(bridge.isPlayerAuthorized).toBe(false)
        expect(bridge.isPlatformStorageAvailable).toBe(false)
    })

    test('initialize exposes the post payload and launch data with claim status', async () => {
        const bridge = await createInitializedBridge({
            ...AUTHORIZED_PLAYER,
            payload: 'level:snoo',
            postId: 't3_xyz',
            subredditName: 'pixelchase',
            postAuthorId: 't2_author',
            postData: { type: 'energy' },
            claimable: true,
            claim: {
                available: false, reason: 'cooldown', count: 3, nextClaimAt: 1725014400000, serverTime: 1725000000000,
            },
        })

        expect(bridge.platformPayload).toBe('level:snoo')
        expect(bridge.launchData).toEqual({
            id: 't3_xyz',
            authorId: 't2_author',
            data: { type: 'energy' },
            claimable: true,
            claim: {
                available: false, reason: 'cooldown', count: 3, nextClaimAt: 1725014400000, serverTime: 1725000000000,
            },
            postId: 't3_xyz',
            subredditName: 'pixelchase',
        })
    })

    test('post context never leaks into player extra', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, postId: 't3_xyz', postData: { level: 42 } })

        expect(bridge.playerExtra).toEqual({})
    })

    test('initialize leaves launch data empty outside a post', async () => {
        const bridge = await createInitializedBridge()

        expect(bridge.platformPayload).toBeNull()
        expect(bridge.launchData).toBeNull()
    })

    test('server time comes from /api/server-time', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ serverTime: 1725000000000 }))

        await expect(bridge.getServerTime()).resolves.toBe(1725000000000)
        expect(lastCall()).toEqual({ url: '/api/server-time', method: 'GET', body: undefined })
    })

    test('storage reads all keys in one request and drops empty values', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse(['1', null, '']))

        const data = await bridge.getDataFromStorage(['coins', 'skin', 'name'])

        expect(lastCall()).toEqual({
            url: '/api/storage/get',
            method: 'POST',
            body: { key: ['coins', 'skin', 'name'] },
        })
        expect(data).toEqual({ coins: '1' })
    })

    test('storage writes all keys in one request', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ success: true }))

        await bridge.setDataToStorage({ coins: '10', skin: 'red' })

        expect(lastCall()).toEqual({
            url: '/api/storage/set',
            method: 'POST',
            body: { key: ['coins', 'skin'], value: ['10', 'red'] },
        })
    })

    test('storage deletes all keys in one request', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ success: true }))

        await bridge.deleteDataFromStorage(['coins', 'skin'])

        expect(lastCall()).toEqual({
            url: '/api/storage/delete',
            method: 'POST',
            body: { key: ['coins', 'skin'] },
        })
    })

    test('storage rejects for a guest without calling the server', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })
        fetchMock.mockClear()

        await expect(bridge.getDataFromStorage(['coins'])).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('share posts a comment under the current post', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ success: true }))

        expect(bridge.isShareSupported).toBe(true)
        await bridge.share({ text: 'I scored 5000!', score: 5000 })

        expect(lastCall()).toEqual({
            url: '/api/share',
            method: 'POST',
            body: { options: { text: 'I scored 5000!', score: 5000 } },
        })
    })

    test('share rejects without text and does not call the server', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockClear()

        await expect(bridge.share({})).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('createPost maps text to the post title and resolves with the created post', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ postId: 't3_new', postUrl: 'https://reddit.com/r/x/t3_new' }))

        const result = await bridge.createPost({ text: 'My level', data: { objects: [] }, claimable: true })

        expect(lastCall()).toEqual({
            url: '/api/create-post',
            method: 'POST',
            body: { options: { title: 'My level', data: { objects: [] }, claimable: true } },
        })
        expect(result).toEqual({
            id: 't3_new', url: 'https://reddit.com/r/x/t3_new', postId: 't3_new', postUrl: 'https://reddit.com/r/x/t3_new',
        })
    })

    test('createPost prefers an explicit title over text', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({}))

        await bridge.createPost({ text: 'ignored', title: 'Explicit' })

        expect(lastCall().body).toEqual({ options: { title: 'Explicit' } })
    })

    test('joinCommunity subscribes to the current subreddit', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ success: true }))

        await bridge.joinCommunity()

        expect(lastCall()).toEqual({ url: '/api/join-community', method: 'POST', body: undefined })
    })

    test('leaderboards are in-game and set score for the authorized player', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ success: true }))

        expect(bridge.leaderboardsType).toBe(LEADERBOARD_TYPE.IN_GAME)
        await bridge.leaderboardsSetScore('main', 1500, true)

        expect(lastCall()).toEqual({
            url: '/api/leaderboards/set-score',
            method: 'POST',
            body: { id: 'main', score: 1500, isMain: true },
        })
    })

    test('leaderboards reject set score for a guest', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })
        fetchMock.mockClear()

        await expect(bridge.leaderboardsSetScore('main', 1500, false)).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('leaderboards normalize entries to the unified shape', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse([
            {
                id: 't2_1', name: 'alice', score: '900', rank: 1, photo: 'https://i.redd.it/a.png',
            },
            { id: 't2_2', name: 'bob', score: 700 },
        ]))

        const entries = await bridge.leaderboardsGetEntries('main')

        expect(lastCall()).toEqual({ url: '/api/leaderboards/entries?id=main', method: 'GET', body: undefined })
        expect(entries).toEqual([
            {
                id: 't2_1', name: 'alice', score: 900, rank: 1, photo: 'https://i.redd.it/a.png',
            },
            {
                id: 't2_2', name: 'bob', score: 700, rank: 0, photo: null,
            },
        ])
    })

    test('leaderboards accept entries wrapped in a data field', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ data: [{ id: 't2_1', name: 'alice', score: 1 }] }))

        const entries = await bridge.leaderboardsGetEntries('main') as unknown[]

        expect(entries).toHaveLength(1)
    })

    test('claim posts the options and resolves with the server verdict', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, postId: 't3_ref', claimable: true })
        const verdict = {
            granted: true, count: 1, nextClaimAt: 1725014400000, serverTime: 1725000000000,
        }
        fetchMock.mockReturnValueOnce(jsonResponse(verdict))

        expect(bridge.isClaimSupported).toBe(true)
        const result = await bridge.claim({ cooldown: 14400, scope: 'user' })

        expect(lastCall()).toEqual({
            url: '/api/claim',
            method: 'POST',
            body: { options: { cooldown: 14400, scope: 'user' } },
        })
        expect(result).toEqual(verdict)
    })

    test('claim rejects outside a claimable post without calling the server', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, postId: 't3_plain' })
        fetchMock.mockClear()

        await expect(bridge.claim({})).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('inbox returns events and acknowledges up to a server time', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({
            events: [{ postId: 't3_ref', from: { id: 't2_b', name: 'bob' }, at: 1725000000000 }],
            serverTime: 1725000001000,
        }))

        const inbox = await bridge.getInbox({ ackUntil: 1724999999000 })

        expect(lastCall()).toEqual({
            url: '/api/inbox',
            method: 'POST',
            body: { options: { ackUntil: 1724999999000 } },
        })
        expect(inbox).toEqual({
            events: [{ postId: 't3_ref', from: { id: 't2_b', name: 'bob' }, at: 1725000000000 }],
            serverTime: 1725000001000,
        })
    })

    test('a failed response rejects with the status and body', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ error: 'boom' }, 500))

        await expect(bridge.joinCommunity()).rejects.toThrow('POST /api/join-community failed (500): {"error":"boom"}')
    })
})
