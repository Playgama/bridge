import {
    describe, test, expect, vi,
} from 'vitest'
import SocialModule from '../../../src/modules/social/SocialModule'
import type { SocialBridgeContract, SocialConfig } from '../../../src/modules/social/types'

// Already platform-resolved by the config loader, so the blocks have no platform key.
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
        isClaimSupported: true,
        isInboxSupported: true,
        inviteFriends: vi.fn().mockResolvedValue('ok'),
        joinCommunity: vi.fn().mockResolvedValue('ok'),
        share: vi.fn().mockResolvedValue('ok'),
        createPost: vi.fn().mockResolvedValue('ok'),
        addToHomeScreen: vi.fn().mockResolvedValue('ok'),
        getAddToHomeScreenReward: vi.fn().mockResolvedValue('ok'),
        addToFavorites: vi.fn().mockResolvedValue('ok'),
        getAddToFavoritesReward: vi.fn().mockResolvedValue('ok'),
        rate: vi.fn().mockResolvedValue('ok'),
        claim: vi.fn().mockResolvedValue({
            granted: true, count: 1, nextClaimAt: null, serverTime: 1,
        }),
        getInbox: vi.fn().mockResolvedValue({ events: [], serverTime: 1 }),
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

    test('createPost passes data and claimable through untouched by the config merge', async () => {
        const data = { objects: [9], theme: 'dark' }
        const bridge = createBridge('ok', {
            options: {
                social: {
                    ...SOCIAL_CONFIG,
                    createPost: { status: false, data: { objects: [1, 2, 3] }, claimable: true },
                },
            },
        })
        await createModule(bridge).createPost({ text: 'Level', data, claimable: false })

        const passed = vi.mocked(bridge.createPost).mock.calls[0][0] as Record<string, unknown>
        expect(passed).toEqual({
            status: false, text: 'Level', data, claimable: false,
        })
        expect(passed.data).toBe(data)
    })

    test('createPost drops config data and claimable when the runtime omits them', async () => {
        const bridge = createBridge('ok', {
            options: {
                social: { ...SOCIAL_CONFIG, createPost: { status: false, data: { level: 1 }, claimable: true } },
            },
        })
        await createModule(bridge).createPost({ text: 'Plain' })

        expect(bridge.createPost).toHaveBeenCalledWith({ status: false, text: 'Plain' })
    })

    test('claim resolves the policy from config with runtime options on top', async () => {
        const bridge = createBridge('reddit', {
            options: { social: { claim: { cooldown: 3600, scope: 'post' } } },
        })
        await createModule(bridge).claim({ scope: 'user' })

        expect(bridge.claim).toHaveBeenCalledWith({ cooldown: 3600, scope: 'user' })
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
        ['claim', 'isClaimSupported'],
        ['getInbox', 'isInboxSupported'],
    ] as const)('%s rejects and does not call the bridge when %s is false', async (method, flag) => {
        const bridge = createBridge('vk', { [flag]: false })
        const module = createModule(bridge)

        await expect((module[method] as () => Promise<unknown>)()).rejects.toBeUndefined()
        expect(bridge[method]).not.toHaveBeenCalled()
    })

    test('claim and getInbox delegate to the bridge with their options', async () => {
        const bridge = createBridge('reddit')
        const module = createModule(bridge)

        await module.claim({ cooldown: 60, scope: 'user' })
        expect(bridge.claim).toHaveBeenCalledWith({ cooldown: 60, scope: 'user' })

        await module.getInbox({ ackUntil: 5 })
        expect(bridge.getInbox).toHaveBeenCalledWith({ ackUntil: 5 })
    })
})
