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
        rewards: [{ id: 'coins', amount: 100 }],
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
        isPostVisitRewardSupported: true,
        isPostAuthorRewardSupported: true,
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
        getPostAuthorReward: vi.fn().mockResolvedValue({ count: 2 }),
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
        await createModule(bridge).createPost({ id: 'gift' })

        // The rewards and their cooldown stay in the config, they are not post content.
        expect(bridge.createPost).toHaveBeenCalledWith({ id: 'gift', text: '🎁 Free coins inside' })
    })

    test('createPost lets runtime options override the config entry', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })
        await createModule(bridge).createPost({ id: 'gift', text: 'My own title' })

        expect(vi.mocked(bridge.createPost).mock.calls[0][0]).toMatchObject({ id: 'gift', text: 'My own title' })
    })

    test('createPost rejects for an id that is not declared in the config', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })

        await expect(createModule(bridge).createPost({ id: 'unknown' })).rejects.toBeUndefined()
        expect(bridge.createPost).not.toHaveBeenCalled()
    })

    test('post visit reward passes the reward policy of the launch post', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS }, launchPostId: 'gift' })
        await createModule(bridge).getPostVisitReward()

        expect(bridge.getPostVisitReward).toHaveBeenCalledWith(14400)
    })

    test('post visit reward rejects when the game was not launched from a post', async () => {
        const bridge = createBridge('reddit', { options: { posts: POSTS } })

        await expect(createModule(bridge).getPostVisitReward()).rejects.toBeUndefined()
        expect(bridge.getPostVisitReward).not.toHaveBeenCalled()
    })

    test('post author reward returns how many players came through the posts', async () => {
        const bridge = createBridge('reddit')

        await expect(createModule(bridge).getPostAuthorReward()).resolves.toEqual({ count: 2 })
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
        ['getPostAuthorReward', 'isPostAuthorRewardSupported'],
    ] as const)('%s rejects and does not call the bridge when %s is false', async (method, flag) => {
        const bridge = createBridge('vk', { [flag]: false })
        const module = createModule(bridge)

        await expect((module[method] as () => Promise<unknown>)()).rejects.toBeUndefined()
        expect(bridge[method]).not.toHaveBeenCalled()
    })
})
