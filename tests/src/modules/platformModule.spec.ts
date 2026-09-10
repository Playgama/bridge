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
        options: { posts: POSTS },
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

    test('merges the config entry of the launch post on top of them', () => {
        const module = createModule(createBridge({ data: { clid: 'partner-1' }, launchPostId: 'gift' }))

        expect(module.data).toEqual({
            clid: 'partner-1',
            id: 'gift',
            text: '🎁 Free coins inside',
            rewards: [{ id: 'coins', amount: 100 }],
        })
    })

    test('keeps the launch parameters when the post id is not declared in the config', () => {
        const module = createModule(createBridge({ data: { clid: 'partner-1' }, launchPostId: 'unknown' }))

        expect(module.data).toEqual({ clid: 'partner-1' })
    })

    test('is an empty object when the launch carries nothing', () => {
        expect(createModule(createBridge()).data).toEqual({})
    })
})
