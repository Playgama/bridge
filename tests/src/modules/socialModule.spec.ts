import {
    describe, test, expect, vi,
} from 'vitest'
import SocialModule from '../../../src/modules/social/SocialModule'
import type { SocialBridgeContract, SocialConfig } from '../../../src/modules/social/types'

// Already platform-resolved by the config loader, so the blocks have no platform key.
const POSTS = [
    {
        id: 'gift',
        text: 'I am sharing coins!',
        rewards: [
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' as const },
        ],
        rewardCooldown: 14400,
        reddit: { text: '🎁 Free coins inside' },
    },
]

const SOCIAL_CONFIG: SocialConfig = {
    share: { image: 'https://cdn.mygame.com/share.png', text: 'Play my game!' },
    joinCommunity: { groupId: 12345 },
    createPost: { status: false },
}

function createBridge(platformId: string, overrides: Record<string, unknown> = {}) {
    return {
        platformId,
        options: { social: SOCIAL_CONFIG },
        isInviteFriendsSupported: true,
        isJoinCommunitySupported: true,
        isShareSupported: true,
        isCreatePostSupported: true,
        isAddToHomeScreenSupported: true,
        isAddToHomeScreenRewardSupported: false,
        isAddToFavoritesSupported: true,
        isAddToFavoritesRewardSupported: false,
        isRateSupported: true,
        isPostRewardSupported: true,
        launchPostId: null,
        inviteFriends: vi.fn().mockResolvedValue('ok'),
        joinCommunity: vi.fn().mockResolvedValue('ok'),
        share: vi.fn().mockResolvedValue('ok'),
        createPost: vi.fn().mockResolvedValue('ok'),
        addToHomeScreen: vi.fn().mockResolvedValue('ok'),
        getAddToHomeScreenReward: vi.fn().mockResolvedValue('ok'),
        addToFavorites: vi.fn().mockResolvedValue('ok'),
        getAddToFavoritesReward: vi.fn().mockResolvedValue('ok'),
        rate: vi.fn().mockResolvedValue('ok'),
        getPostVisitReward: vi.fn().mockResolvedValue(undefined),
        getPostAuthorReward: vi.fn().mockResolvedValue({ gift: 2 }),
        ...overrides,
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new SocialModule().initialize(bridge as unknown as SocialBridgeContract)
}

describe('SocialModule', () => {
    test('share passes config data merged with runtime options to the bridge', async () => {
        const bridge = createBridge('facebook')
        await createModule(bridge).share({ text: 'I scored 5000!' })

        expect(bridge.share).toHaveBeenCalledWith({
            image: 'https://cdn.mygame.com/share.png',
            text: 'I scored 5000!',
        })
    })

    test('joinCommunity passes the static config block with no runtime options', async () => {
        const bridge = createBridge('vk')
        await createModule(bridge).joinCommunity()

        expect(bridge.joinCommunity).toHaveBeenCalledWith({ groupId: 12345 })
    })

    test('createPost merges the config status flag with runtime content', async () => {
        const bridge = createBridge('ok')
        await createModule(bridge).createPost({ text: 'Hello', url: 'https://mygame.com' })

        expect(bridge.createPost).toHaveBeenCalledWith({
            status: false,
            text: 'Hello',
            url: 'https://mygame.com',
        })
    })

    test('createPost takes the content of the config posts entry addressed by id', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })
        await createModule(bridge).createPost('gift')

        // Only the content reaches the platform; the id travels beside it and the
        // rewards, the cooldown and the game's own keys stay in the config.
        expect(bridge.createPost).toHaveBeenCalledWith({ text: '🎁 Free coins inside' }, 'gift')
    })

    test('createPost sends no config data to the platform sdk', async () => {
        const bridge = createBridge('ok', {
            options: {
                posts: [{
                    id: 'gift',
                    text: 'Take my coins',
                    rewards: [{ id: 'coins', amount: 100 }],
                    rewardCooldown: 14400,
                    card: { title: '+100 COINS' },
                    secretGameKey: 'do not send me',
                    ok: { status: true },
                }],
            },
        })
        await createModule(bridge).createPost('gift')

        expect(bridge.createPost).toHaveBeenCalledWith({ text: 'Take my coins', status: true }, 'gift')
    })

    test('createPost keeps taking a content object, the way it worked before post ids', async () => {
        const bridge = createBridge('ok')
        await createModule(bridge).createPost({ text: 'Hand-written post' })

        expect(bridge.createPost).toHaveBeenCalledWith({ status: false, text: 'Hand-written post' })
    })

    test('createPost rejects for an id that is not declared in the config', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })

        await expect(createModule(bridge).createPost('unknown')).rejects.toBeUndefined()
        expect(bridge.createPost).not.toHaveBeenCalled()
    })

    test('post reward returns the visit rewards of the post the game was launched from', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS }, launchPostId: 'gift' })

        await expect(createModule(bridge).getPostReward()).resolves.toEqual([
            { id: 'coins', amount: 100, type: 'visit' },
        ])
        expect(bridge.getPostVisitReward).toHaveBeenCalledWith(14400)
    })

    test('post reward rejects and calls nothing when the platform does not support it', async () => {
        const bridge = createBridge('vk', { isPostRewardSupported: false })

        await expect(createModule(bridge).getPostReward()).rejects.toBeUndefined()
        expect(bridge.getPostVisitReward).not.toHaveBeenCalled()
        expect(bridge.getPostAuthorReward).not.toHaveBeenCalled()
    })

    test('post reward multiplies the author rewards by the players counted', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })

        await expect(createModule(bridge).getPostReward()).resolves.toEqual([
            { id: 'coins', amount: 100, type: 'author' },
        ])
        expect(bridge.getPostVisitReward).not.toHaveBeenCalled()
    })

    test('passes runtime options as is when there is no social config', async () => {
        const bridge = createBridge('vk', { options: {} })
        await createModule(bridge).share({ url: 'https://other.com' })

        expect(bridge.share).toHaveBeenCalledWith({ url: 'https://other.com' })
    })

    test('capability getters proxy the platform bridge', () => {
        const module = createModule(createBridge('vk', { isShareSupported: false }))
        expect(module.isShareSupported).toBe(false)
        expect(module.isJoinCommunitySupported).toBe(true)
    })

    test('getAddToHomeScreenReward rejects when the platform does not support it', async () => {
        const bridge = createBridge('vk', { isAddToHomeScreenRewardSupported: false })
        await expect(createModule(bridge).getAddToHomeScreenReward()).rejects.toBeUndefined()
        expect(bridge.getAddToHomeScreenReward).not.toHaveBeenCalled()
    })

    // Guard regression: an unsupported action must reject instead of forwarding to
    // the bridge. Bridges only implement the methods they support, so forwarding an
    // unsupported call would hit an undefined method and throw synchronously.
    test.each([
        ['inviteFriends', 'isInviteFriendsSupported'],
        ['joinCommunity', 'isJoinCommunitySupported'],
        ['share', 'isShareSupported'],
        ['createPost', 'isCreatePostSupported'],
        ['addToHomeScreen', 'isAddToHomeScreenSupported'],
        ['addToFavorites', 'isAddToFavoritesSupported'],
        ['rate', 'isRateSupported'],
    ] as const)('%s rejects and does not call the bridge when %s is false', async (method, flag) => {
        const bridge = createBridge('vk', { [flag]: false })
        const module = createModule(bridge)

        await expect((module[method] as () => Promise<unknown>)()).rejects.toBeUndefined()
        expect(bridge[method]).not.toHaveBeenCalled()
    })
})
