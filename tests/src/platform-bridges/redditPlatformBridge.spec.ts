import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import RedditPlatformBridge from '../../../src/platform-bridges/RedditPlatformBridge'
import { LEADERBOARD_TYPE } from '../../../src/modules/leaderboards/constants'
import { LAUNCH_SOURCE } from '../../../src/constants/launchSource'

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

function calls(): FetchCall[] {
    return fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => ({
        url,
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(init.body as string) : undefined,
    }))
}

function lastCall(): FetchCall {
    const all = calls()
    return all[all.length - 1]
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
    fetchMock.mockClear()
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
        fetchMock.mockReturnValueOnce(jsonResponse(AUTHORIZED_PLAYER))
        const bridge = new RedditPlatformBridge()
        await bridge.initialize()

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
        expect(bridge.playerExtra).toEqual({})
    })

    test('server time comes from /api/server-time', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ serverTime: 1725000000000 }))

        await expect(bridge.getServerTime()).resolves.toBe(1725000000000)
        expect(lastCall()).toEqual({ url: '/api/server-time', method: 'GET', body: undefined })
    })

    test('server time is cached, so a second call makes no request', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ serverTime: 1725000000000 }))

        await bridge.getServerTime()
        await bridge.getServerTime()

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    test('storage reads every key and drops empty values', async () => {
        const bridge = await createInitializedBridge()
        fetchMock
            .mockReturnValueOnce(jsonResponse('1'))
            .mockReturnValueOnce(jsonResponse(null))

        const data = await bridge.getDataFromStorage(['coins', 'skin'])

        expect(calls()).toEqual([
            { url: '/api/storage/get', method: 'POST', body: { key: 'coins' } },
            { url: '/api/storage/get', method: 'POST', body: { key: 'skin' } },
        ])
        expect(data).toEqual({ coins: '1' })
    })

    test('storage writes every key', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValue(jsonResponse({ success: true }))

        await bridge.setDataToStorage({ coins: '10' })

        expect(lastCall()).toEqual({
            url: '/api/storage/set',
            method: 'POST',
            body: { key: 'coins', value: '10' },
        })
    })

    test('storage deletes every key', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValue(jsonResponse({ success: true }))

        await bridge.deleteDataFromStorage(['coins'])

        expect(lastCall()).toEqual({ url: '/api/storage/delete', method: 'POST', body: { key: 'coins' } })
    })

    test('storage rejects for a guest without calling the server', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })

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

        await expect(bridge.share({})).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('createPost sends the post id with the title and resolves with the link', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ postId: 't3_new', postUrl: 'https://reddit.com/r/x/t3_new' }))

        const result = await bridge.createPost({ id: 'gift', text: '🎁 Free coins inside' })

        expect(lastCall()).toEqual({
            url: '/api/create-post',
            method: 'POST',
            body: { options: { id: 'gift', title: '🎁 Free coins inside' } },
        })
        expect(result).toEqual({ url: 'https://reddit.com/r/x/t3_new' })
    })

    test('initialize remembers the post the game was launched from', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, post: { id: 'gift' } })

        expect(bridge.launchPostId).toBe('gift')
        expect(bridge.launchSource).toBe(LAUNCH_SOURCE.POST)
    })

    test('initialize leaves the launch post empty outside a created post', async () => {
        const bridge = await createInitializedBridge()

        expect(bridge.launchPostId).toBeNull()
        expect(bridge.launchSource).toBeNull()
    })

    test('post visit reward sends the policy and resolves when the server grants it', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, post: { id: 'gift' } })
        fetchMock.mockReturnValueOnce(jsonResponse({ granted: true }))

        expect(bridge.isPostRewardSupported).toBe(true)
        await expect(bridge.getPostVisitReward(14400)).resolves.toBeUndefined()

        expect(lastCall()).toEqual({
            url: '/api/post-visit-reward',
            method: 'POST',
            body: { cooldown: 14400 },
        })
    })

    test('post visit reward rejects when the server denies it', async () => {
        const bridge = await createInitializedBridge({ ...AUTHORIZED_PLAYER, post: { id: 'gift' } })
        fetchMock.mockReturnValueOnce(jsonResponse({ granted: false }))

        await expect(bridge.getPostVisitReward()).rejects.toBeUndefined()
    })

    test('post visit reward rejects outside a created post without calling the server', async () => {
        const bridge = await createInitializedBridge()

        await expect(bridge.getPostVisitReward()).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('post author reward resolves with the players counted per post', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ counts: { gift: '3', level: 0 } }))

        await expect(bridge.getPostAuthorReward()).resolves.toEqual({ gift: 3 })
        expect(lastCall()).toEqual({ url: '/api/post-author-reward', method: 'POST', body: undefined })
    })

    test('post author reward rejects for a guest without calling the server', async () => {
        const bridge = await createInitializedBridge({ isPlayerAuthorized: false })

        await expect(bridge.getPostAuthorReward()).rejects.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
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

    test('a failed response rejects with the status and body', async () => {
        const bridge = await createInitializedBridge()
        fetchMock.mockReturnValueOnce(jsonResponse({ error: 'boom' }, 500))

        await expect(bridge.joinCommunity()).rejects.toThrow('POST /api/join-community failed (500): {"error":"boom"}')
    })
})
