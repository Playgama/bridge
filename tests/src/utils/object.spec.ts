import { describe, test, expect } from 'vitest'
import { deepMerge } from '../../../src/utils/object'

describe('deepMerge', () => {
    test('merges nested objects key by key', () => {
        expect(deepMerge(
            { share: { text: 'Hi', image: 'common.png' } },
            { share: { image: 'vk.png' } },
        )).toEqual({ share: { text: 'Hi', image: 'vk.png' } })
    })

    test('replaces an array whole instead of merging it by index', () => {
        expect(deepMerge(
            { leaderboards: [{ id: 'best' }, { id: 'daily' }] },
            { leaderboards: [{ id: 'weekly' }] },
        )).toEqual({ leaderboards: [{ id: 'weekly' }] })
    })

    test('replaces a value of another type', () => {
        expect(deepMerge(
            { a: [1, 2], b: { x: 1 } },
            { a: { k: 1 }, b: [3] },
        )).toEqual({ a: { k: 1 }, b: [3] })
    })

    test('keeps what the second object does not name and does not mutate the inputs', () => {
        const first = { rewards: ['coins', 'gems'], cycle: true }
        const second = { rewards: ['chest'] }

        expect(deepMerge(first, second)).toEqual({ rewards: ['chest'], cycle: true })
        expect(first).toEqual({ rewards: ['coins', 'gems'], cycle: true })
        expect(second).toEqual({ rewards: ['chest'] })
    })
})
