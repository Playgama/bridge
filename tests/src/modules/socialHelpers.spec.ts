import { describe, test, expect } from 'vitest'
import {
    getSocialPlatformData, getSocialContent, getPostPlatformData, getPostRewards,
} from '../../../src/modules/social/helpers'
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

describe('getSocialContent', () => {
    test('returns the content fields with the platform block over them', () => {
        expect(getSocialContent(POSTS, 'reddit', 'gift')).toEqual({
            text: '🎁 Free coins inside',
            image: 'gift.png',
        })
    })

    test('leaves out the id, the rewards and the blocks of other platforms', () => {
        expect(getSocialContent(POSTS, 'ok', 'gift')).toEqual({
            text: 'I am sharing coins!',
            image: 'gift.png',
            status: true,
        })
    })

    test('returns null for an id that is not declared', () => {
        expect(getSocialContent(POSTS, 'reddit', 'unknown')).toBeNull()
        expect(getSocialContent(undefined, 'reddit', 'gift')).toBeNull()
    })
})

describe('getPostPlatformData', () => {
    test('takes the rewards and the cooldown from the common fields', () => {
        const post = getPostPlatformData(POSTS, 'ok', 'gift')

        expect(post?.rewards).toEqual([
            { id: 'coins', amount: 100 },
            { id: 'coins', amount: 50, type: 'author' },
        ])
        expect(post?.rewardCooldown).toBe(14400)
    })

    test('lets the platform block replace the rewards and the cooldown', () => {
        const posts: PostMapping[] = [{
            id: 'gift',
            rewards: [{ id: 'coins', amount: 100 }],
            rewardCooldown: 14400,
            reddit: { rewards: [{ id: 'gems', amount: 5 }], rewardCooldown: 60 },
        }]
        const post = getPostPlatformData(posts, 'reddit', 'gift')

        // The array is replaced as a whole, not merged index by index into an object.
        expect(post?.rewards).toEqual([{ id: 'gems', amount: 5 }])
        expect(post?.rewardCooldown).toBe(60)
        expect(getPostRewards(post, 'visit', 1)).toEqual([{ id: 'gems', amount: 5, type: 'visit' }])
    })

    test('merges nested objects of the platform block field by field', () => {
        const posts: PostMapping[] = [{
            id: 'gift',
            card: { title: '+100 COINS', button: 'OPEN GIFT' },
            reddit: { card: { title: '+200 COINS' } },
        }]

        expect(getPostPlatformData(posts, 'reddit', 'gift')?.card).toEqual({ title: '+200 COINS', button: 'OPEN GIFT' })
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
