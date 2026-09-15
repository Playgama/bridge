import {
    describe, test, expect, vi,
} from 'vitest'
import PlatformModule from '../../../src/modules/platform/PlatformModule'
import type { PlatformBridgeContract } from '../../../src/modules/platform/PlatformModule'
import type { PostMapping } from '../../../src/modules/social/types'

const POSTS: PostMapping[] = [
    {
        id: 'gift',
        text: 'I am sharing coins!',
        rewards: [{ id: 'coins', amount: 100 }],
        reddit: { text: '🎁 Free coins inside' },
    },
]

function createBridge(overrides: Record<string, unknown> = {}) {
    return {
        platformId: 'reddit',
        // PlatformModule forwards audio and pause events on initialize.
        on: vi.fn(),
        data: {},
        launchPostId: null,
        options: { social: { posts: POSTS } },
        ...overrides,
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new PlatformModule().initialize(bridge as unknown as PlatformBridgeContract)
}

describe('PlatformModule data', () => {
    test('returns the launch parameters of the platform when there is no post', () => {
        const module = createModule(createBridge({ data: { clid: 'partner-1' } }))

        expect(module.data).toEqual({ clid: 'partner-1' })
    })

    test('adds the id of the post the game was launched from', () => {
        const module = createModule(createBridge({ data: { clid: 'partner-1' }, launchPostId: 'gift' }))

        expect(module.data).toEqual({ clid: 'partner-1', postId: 'gift' })
    })

    test('is an empty object when the launch carries nothing', () => {
        expect(createModule(createBridge()).data).toEqual({})
    })
})
