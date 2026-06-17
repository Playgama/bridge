import { describe, test, expect } from 'vitest'
import { getSocialPlatformData } from '../../../src/modules/social/helpers'
import type { SocialConfig } from '../../../src/modules/social/types'

const SOCIAL_CONFIG: SocialConfig = {
    share: {
        vk: { url: 'https://mygame.com' },
        facebook: { image: 'https://cdn.mygame.com/share.png', text: 'Play my game!' },
    },
    joinCommunity: {
        ok: { groupId: 67890, enableMessages: true },
    },
}

describe('getSocialPlatformData', () => {
    test('returns the static config block for the platform', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'joinCommunity', 'ok')).toEqual({
            groupId: 67890,
            enableMessages: true,
        })
    })

    test('merges runtime options over the config, runtime wins', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'share', 'facebook', { text: 'I scored 5000!' })).toEqual({
            image: 'https://cdn.mygame.com/share.png',
            text: 'I scored 5000!',
        })
    })

    test('returns runtime options when the platform has no config', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'share', 'discord', { url: 'https://x' })).toEqual({
            url: 'https://x',
        })
    })

    test('returns an empty object when neither config nor runtime is present', () => {
        expect(getSocialPlatformData(SOCIAL_CONFIG, 'createPost', 'ok')).toEqual({})
    })

    test('returns runtime options when there is no social config at all', () => {
        expect(getSocialPlatformData(undefined, 'share', 'vk', { url: 'https://y' })).toEqual({
            url: 'https://y',
        })
    })

    test('does not mutate the config block', () => {
        getSocialPlatformData(SOCIAL_CONFIG, 'share', 'vk', { url: 'https://override' })
        expect(SOCIAL_CONFIG.share?.vk).toEqual({ url: 'https://mygame.com' })
    })
})
