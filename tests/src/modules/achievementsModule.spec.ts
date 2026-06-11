import {
    describe, test, expect, vi,
} from 'vitest'
import AchievementsModule from '../../../src/modules/achievements/AchievementsModule'
import configLoader from '../../../src/lib/bridge-config-loader'
import type {
    AchievementsBridgeContract,
    AchievementMapping,
    NormalizedAchievement,
} from '../../../src/modules/achievements/types'

vi.mock('../../../src/lib/bridge-config-loader', () => ({
    default: {
        getPlatformOptions: vi.fn(() => ({})),
    },
}))

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

function mockConfig(achievements?: AchievementMapping[]) {
    vi.mocked(configLoader.getPlatformOptions).mockReturnValue(
        achievements ? { achievements } : {},
    )
}

function createBridge(platformId: string, overrides: Record<string, unknown> = {}) {
    return {
        platformId,
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
        test('resolves the platform data object for the current platform', async () => {
            mockConfig(ACHIEVEMENTS_CONFIG)
            const bridge = createBridge('y8')
            await createModule(bridge).unlock('first_win')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith({
                achievement: 'First Win',
                achievementkey: 'a1b2c3',
            })
        })

        test('passes the game id when the platform has no mapping', async () => {
            mockConfig(ACHIEVEMENTS_CONFIG)
            const bridge = createBridge('y8')
            await createModule(bridge).unlock('collector')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('collector')
        })

        test('passes the game id when the id is not in the config', async () => {
            mockConfig(ACHIEVEMENTS_CONFIG)
            const bridge = createBridge('lagged')
            await createModule(bridge).unlock('unknown_achievement')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('unknown_achievement')
        })

        test('passes the game id when there is no achievements config', async () => {
            mockConfig(undefined)
            const bridge = createBridge('lagged')
            await createModule(bridge).unlock('first_win')

            expect(bridge.achievementsUnlock).toHaveBeenCalledWith('first_win')
        })

        test('requests the config for the current platform', async () => {
            mockConfig(ACHIEVEMENTS_CONFIG)
            const bridge = createBridge('lagged')
            await createModule(bridge).unlock('first_win')

            expect(configLoader.getPlatformOptions).toHaveBeenCalledWith('lagged')
            expect(bridge.achievementsUnlock).toHaveBeenCalledWith({ id: 'win_1' })
        })
    })

    describe('getList', () => {
        test('returns the normalized list from the platform bridge as is', async () => {
            const platformList: NormalizedAchievement[] = [
                { id: 'first_win', name: 'First Win', unlocked: true },
            ]
            const bridge = createBridge('y8', {
                achievementsGetList: vi.fn().mockResolvedValue(platformList),
            })

            const list = await createModule(bridge).getList()

            expect(list).toEqual(platformList)
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
