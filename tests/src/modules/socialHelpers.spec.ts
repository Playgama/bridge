import { describe, test, expect } from 'vitest'
import { getSocialPlatformData } from '../../../src/modules/social/helpers'
import type { SocialConfig } from '../../../src/modules/social/types'

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
