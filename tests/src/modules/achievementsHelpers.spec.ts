import { describe, test, expect } from 'vitest'
import {
    getAchievementPlatformData,
    findAchievementGameId,
} from '../../../src/modules/achievements/helpers'
import type { AchievementMapping } from '../../../src/modules/achievements/types'

const ACHIEVEMENTS_CONFIG: AchievementMapping[] = [
    {
        id: 'first_win',
        lagged: { id: 'win_1' },
        y8: { achievement: 'First Win', achievementkey: 'a1b2c3' },
    },
    {
        id: 'collector',
        lagged: { id: 'collect_10' },
    },
]

describe('getAchievementPlatformData', () => {
    test('returns the platform data object for a mapped achievement', () => {
        expect(getAchievementPlatformData(ACHIEVEMENTS_CONFIG, 'y8', 'first_win')).toEqual({
            achievement: 'First Win',
            achievementkey: 'a1b2c3',
        })
        expect(getAchievementPlatformData(ACHIEVEMENTS_CONFIG, 'lagged', 'first_win')).toEqual({
            id: 'win_1',
        })
    })

    test('falls back to the game id when the platform has no mapping', () => {
        expect(getAchievementPlatformData(ACHIEVEMENTS_CONFIG, 'y8', 'collector')).toBe('collector')
    })

    test('falls back to the game id when the id is not in the config', () => {
        expect(getAchievementPlatformData(ACHIEVEMENTS_CONFIG, 'lagged', 'unknown')).toBe('unknown')
    })

    test('falls back to the game id when there is no config', () => {
        expect(getAchievementPlatformData(undefined, 'lagged', 'first_win')).toBe('first_win')
    })

    test('ignores non-object platform values', () => {
        const config: AchievementMapping[] = [{ id: 'first_win', lagged: 'win_1' }]
        expect(getAchievementPlatformData(config, 'lagged', 'first_win')).toBe('first_win')
    })
})

describe('findAchievementGameId', () => {
    test('finds the game id by a platform-specific predicate', () => {
        const gameId = findAchievementGameId(
            ACHIEVEMENTS_CONFIG,
            'y8',
            (platformData) => platformData.achievementkey === 'a1b2c3',
        )
        expect(gameId).toBe('first_win')
    })

    test('returns null when nothing matches', () => {
        const gameId = findAchievementGameId(
            ACHIEVEMENTS_CONFIG,
            'y8',
            (platformData) => platformData.achievementkey === 'missing',
        )
        expect(gameId).toBeNull()
    })

    test('returns null when there is no config', () => {
        expect(findAchievementGameId(undefined, 'y8', () => true)).toBeNull()
    })

    test('skips platforms without an object mapping', () => {
        const gameId = findAchievementGameId(
            ACHIEVEMENTS_CONFIG,
            'lagged',
            (platformData) => platformData.id === 'collect_10',
        )
        expect(gameId).toBe('collector')
    })
})
