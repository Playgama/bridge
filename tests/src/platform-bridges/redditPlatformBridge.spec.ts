import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import RedditPlatformBridge from '../../../src/platform-bridges/RedditPlatformBridge'
import { LAUNCH_SOURCE } from '../../../src/constants/launchSource'
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

    test('initialize marks a post launch and exposes the post payload', async () => {
        const bridge = await createInitializedBridge({
            ...AUTHORIZED_PLAYER,
            postId: 't3_xyz',
            payload: '{"type":"energy"}',
        })

        expect(bridge.launchSource).toBe(LAUNCH_SOURCE.POST)
        expect(bridge.platformPayload).toBe('{"type":"energy"}')
    })

    test('initialize leaves the launch source and payload empty outside a post', async () => {
        const bridge = await createInitializedBridge()

        expect(bridge.launchSource).toBeNull()
        expect(bridge.platformPayload).toBeNull()
        expect(bridge.playerExtra).toEqual({})
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

        const result = await bridge.createPost({ text: 'My level', payload: '{"objects":[]}' })

        expect(lastCall()).toEqual({
            url: '/api/create-post',
            method: 'POST',
            body: { options: { title: 'My level', payload: '{"objects":[]}' } },
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

    test('post reward posts the options and resolves when the server grants it', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, postId: 't3_ref' })
        fetchMock.mockReturnValueOnce(jsonResponse({ granted: true }))

        expect(bridge.isPostRewardSupported).toBe(true)
        await expect(bridge.getPostReward({ cooldown: 14400, scope: 'user' })).resolves.toBeUndefined()

        expect(lastCall()).toEqual({
            url: '/api/post-reward',
            method: 'POST',
            body: { options: { cooldown: 14400, scope: 'user' } },
        })
    })

    test('post reward rejects when the server denies it', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, postId: 't3_ref' })
        fetchMock.mockReturnValueOnce(jsonResponse({ granted: false, reason: 'cooldown' }))

        await expect(bridge.getPostReward()).rejects.toBeUndefined()
    })

    test('post reward rejects outside a post without calling the server', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockClear()

        await expect(bridge.getPostReward()).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('create post reward resolves with the number of rewarded players', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ count: '3' }))

        expect(bridge.isCreatePostRewardSupported).toBe(true)
        await expect(bridge.getCreatePostReward()).resolves.toEqual({ count: 3 })
        expect(lastCall()).toEqual({ url: '/api/create-post-reward', method: 'POST', body: undefined })
    })

    test('create post reward rejects for a guest without calling the server', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })
        fetchMock.mockClear()

        await expect(bridge.getCreatePostReward()).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('a failed response rejects with the status and body', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ error: 'boom' }, 500))

        await expect(bridge.joinCommunity()).rejects.toThrow('POST /api/join-community failed (500): {"error":"boom"}')
    })
})
