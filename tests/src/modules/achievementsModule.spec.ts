import {
    describe, test, expect, vi,
} from 'vitest'
import AchievementsModule from '../../../src/modules/achievements/AchievementsModule'
import type {
    AchievementsBridgeContract,
    AchievementMapping,
    NormalizedAchievement,
} from '../../../src/modules/achievements/types'

const ACHIEVEMENTS_CONFIG: AchievementMapping[] = [
    {
        id: 'first_win',
        lagged: 'win_1',
        y8: { achievement: 'First Win', achievementkey: 'a1b2c3' },
    },
    {
        id: 'collector',
        lagged: 'collect_10',
    },
]

function createBridge(platformId: string, overrides: Record<string, unknown> = {}) {
    return {
        platformId,
        options: { achievements: ACHIEVEMENTS_CONFIG },
        isAchievementsSupported: true,
        isGetAchievementsListSupported: true,
        isAchievementsNativePopupSupported: true,
        achievementsUnlock: vi.fn().mockResolvedValue('unlocked'),
        achievementsGetList: vi.fn().mockResolvedValue([]),
        achievementsShowNativePopup: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new AchievementsModule().initialize(bridge as unknown as AchievementsBridgeContract)
}

describe('AchievementsModule', () => {
    describe('unlock', () => {
        test('resolves a string mapping for the current platform', async () => {
            const bridge = createBridge('lagged')
            await createModule(bridge).unlock('first_win')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('win_1')
        })

        test('resolves an object mapping for the current platform', async () => {
            const bridge = createBridge('y8')
            await createModule(bridge).unlock('first_win')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith({
                achievement: 'First Win',
                achievementkey: 'a1b2c3',
            })
        })

        test('falls back to the game id when the platform has no mapping', async () => {
            const bridge = createBridge('y8')
            await createModule(bridge).unlock('collector')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('collector')
        })

        test('falls back to the game id when the id is not in the config', async () => {
            const bridge = createBridge('lagged')
            await createModule(bridge).unlock('unknown_achievement')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('unknown_achievement')
        })

        test('falls back to the game id when there is no achievements config', async () => {
            const bridge = createBridge('lagged', { options: {} })
            await createModule(bridge).unlock('first_win')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('first_win')
        })
    })

    describe('getList', () => {
        test('maps platform ids back to game ids for string mappings', async () => {
            const platformList: NormalizedAchievement[] = [
                { id: 'win_1', name: 'First Win', unlocked: true },
                { id: 'collect_10', name: 'Collector', unlocked: false },
            ]
            const bridge = createBridge('lagged', {
                achievementsGetList: vi.fn().mockResolvedValue(platformList),
            })

            const list = await createModule(bridge).getList()

            expect(list.map((a) => a.id)).toEqual(['first_win', 'collector'])
        })

        test('maps platform ids back to game ids for object mappings', async () => {
            const platformList: NormalizedAchievement[] = [
                { id: 'a1b2c3', name: 'First Win', unlocked: true },
            ]
            const bridge = createBridge('y8', {
                achievementsGetList: vi.fn().mockResolvedValue(platformList),
            })

            const list = await createModule(bridge).getList()

            expect(list[0].id).toBe('first_win')
        })

        test('keeps unknown platform ids as is', async () => {
            const platformList: NormalizedAchievement[] = [
                { id: 'not_in_config', unlocked: true },
            ]
            const bridge = createBridge('lagged', {
                achievementsGetList: vi.fn().mockResolvedValue(platformList),
            })

            const list = await createModule(bridge).getList()

            expect(list[0].id).toBe('not_in_config')
        })

        test('preserves normalized fields', async () => {
            const platformList: NormalizedAchievement[] = [
                {
                    id: 'win_1',
                    name: 'First Win',
                    description: 'Win your first game',
                    unlocked: true,
                    platformData: { raw: true },
                },
            ]
            const bridge = createBridge('lagged', {
                achievementsGetList: vi.fn().mockResolvedValue(platformList),
            })

            const list = await createModule(bridge).getList()

            expect(list[0]).toEqual({
                id: 'first_win',
                name: 'First Win',
                description: 'Win your first game',
                unlocked: true,
                platformData: { raw: true },
            })
        })
    })

    describe('showNativePopup', () => {
        test('delegates to the platform bridge', async () => {
            const bridge = createBridge('y8')
            await createModule(bridge).showNativePopup()

            expect(bridge.achievementsShowNativePopup).toHaveBeenCalled()
        })
    })

    describe('support flags', () => {
        test('proxies the platform bridge getters', () => {
            const bridge = createBridge('y8', {
                isAchievementsSupported: true,
                isGetAchievementsListSupported: false,
                isAchievementsNativePopupSupported: true,
            })
            const module = createModule(bridge)

            expect(module.isSupported).toBe(true)
            expect(module.isGetListSupported).toBe(false)
            expect(module.isNativePopupSupported).toBe(true)
        })
    })
})
