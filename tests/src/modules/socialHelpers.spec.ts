import { describe, test, expect } from 'vitest'
import { getSocialPlatformData, getPostPlatformData, getPostRewards } from '../../../src/modules/social/helpers'
import type { SocialConfig, PostMapping } from '../../../src/modules/social/types'

// The config loader resolves `social[method]` for the active platform before the
// module reads it (common `social` block merged with `platforms[id].social`), so
// the blocks here have no platform key — they are the already-resolved data.
const SOCIAL_CONFIG: SocialConfig = {
    share: { url: 'https://mygame.com', image: 'https://cdn.mygame.com/share.png' },
    joinCommunity: { groupId: 67890, enableMessages: true },
}

describe('getSocialPlatformData', () => {
    test('returns the resolved config block for the method', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'joinCommunity')).toEqual({
            groupId: 67890,
            enableMessages: true,
        })
    })

    test('merges runtime options over the config, runtime wins', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'share', { url: 'https://override' })).toEqual({
            url: 'https://override',
            image: 'https://cdn.mygame.com/share.png',
        })
    })

    test('returns runtime options when the method has no config', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'createPost', { text: 'I scored 5000!' })).toEqual({
            text: 'I scored 5000!',
        })
    })

    test('returns an empty object when neither config nor runtime is present', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'createPost')).toEqual({})
    })

    test('returns runtime options when there is no social config at all', () => {
        expect(getSocialPlatformData(undefined, 'share', { url: 'https://y' })).toEqual({
            url: 'https://y',
        })
    })

    test('does not mutate the config block', () => {
        getSocialPlatformData(SOCIAL_CONFIG, 'share', { url: 'https://override' })
        expect(SOCIAL_CONFIG.share).toEqual({
            url: 'https://mygame.com',
            image: 'https://cdn.mygame.com/share.png',
        })
    })

    test('forwards arbitrary platform-native fields, merging config and runtime (runtime wins)', () => {
        const config: SocialConfig = {
            share: { url: 'https://mygame.com', attachments: 'photo1' },
        }
        expect(getSocialPlatformData(config, 'share', { attachments: 'photo2', myField: 'x' })).toEqual({
            url: 'https://mygame.com',
            attachments: 'photo2',
            myField: 'x',
        })
    })
})

// Posts are declared once for every platform: common content, a block named
// after a platform for its own fields, and any other key for the game itself.
const POSTS: PostMapping[] = [
    {
        id: 'gift',
        text: 'I am sharing coins!',
        image: 'gift.png',
        rewards: [
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' },
        ],
        rewardCooldown: 14400,
        ok: { status: true },
        reddit: { text: '🎁 Free coins inside' },
    },
]

describe('getPostPlatformData', () => {
    test('merges the platform block over the common fields', () => {
        expect(getPostPlatformData(POSTS, 'reddit', 'gift')).toEqual({
            id: 'gift',
            text: '🎁 Free coins inside',
            image: 'gift.png',
            rewards: [
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' },
        ],
            rewardCooldown: 14400,
        })
    })

    test('drops the blocks of other platforms', () => {
        const post = getPostPlatformData(POSTS, 'ok', 'gift')

        expect(post).toEqual({
            id: 'gift',
            text: 'I am sharing coins!',
            image: 'gift.png',
            rewards: [
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' },
        ],
            rewardCooldown: 14400,
            status: true,
        })
    })

    test('returns the common fields when the platform has no block', () => {
        expect(getPostPlatformData(POSTS, 'vk', 'gift')).toEqual({
            id: 'gift',
            text: 'I am sharing coins!',
            image: 'gift.png',
            rewards: [
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' },
        ],
            rewardCooldown: 14400,
        })
    })

    test('returns null for an id that is not declared', () => {
        expect(getPostPlatformData(POSTS, 'reddit', 'unknown')).toBeNull()
        expect(getPostPlatformData(undefined, 'reddit', 'gift')).toBeNull()
    })
})

describe('getPostRewards', () => {
    const post = getPostPlatformData(POSTS, 'reddit', 'gift')

    test('returns the rewards of the player who came through the post', () => {
        expect(getPostRewards(post, 'visit', 1)).toEqual([{ id: 'coins', amount: 100, type: 'visit' }])
    })

    test('multiplies the author rewards by the players counted', () => {
        expect(getPostRewards(post, 'author', 3)).toEqual([{ id: 'coins', amount: 150, type: 'author' }])
    })

    test('returns nothing for a post that declares no rewards', () => {
        expect(getPostRewards(null, 'visit', 1)).toEqual([])
    })
})
