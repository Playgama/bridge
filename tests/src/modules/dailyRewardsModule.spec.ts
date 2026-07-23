import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import DailyRewardsModule from '../../../src/modules/daily-rewards/DailyRewardsModule'
import bridgeConfig from '../../../src/lib/bridge-config'
import { MS_PER_DAY } from '../../../src/modules/daily-rewards/constants'
import type { DailyRewardsBridgeContract } from '../../../src/modules/daily-rewards/types'

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }))

vi.mock('../../../src/modules/storage', () => ({
    default: {
        get: vi.fn((key: string) => Promise.resolve(
            store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : null,
        )),
        set: vi.fn((key: string, value: unknown) => {
            store.set(key, JSON.parse(JSON.stringify(value)))
            return Promise.resolve()
        }),
    },
}))

vi.mock('../../../src/lib/bridge-config', () => ({
    default: {
        getValues: vi.fn(() => ({})),
    },
}))

const BASE_MS = 100 * MS_PER_DAY

// A bridge with a movable server clock and spied notification hooks.
function createBridge() {
    const clock = { ms: BASE_MS }
    return {
        platformId: 'mock',
        getServerTime: vi.fn(() => Promise.resolve(clock.ms)),
        dailyRewardsClaimed: vi.fn(),
        dailyRewardsReset: vi.fn(),
        clock,
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new DailyRewardsModule().initialize(bridge as unknown as DailyRewardsBridgeContract)
}

describe('DailyRewardsModule platform notifications', () => {
    beforeEach(() => {
        store.clear()
        vi.mocked(bridgeConfig.getValues).mockReturnValue({
            dailyRewards: { rewards: ['a', 'b', 'c'] },
        })
    })

    test('successful claim notifies the platform bridge', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        expect(await module.claimCurrentReward()).toBe(true)
        expect(bridge.dailyRewardsClaimed).toHaveBeenCalledWith({ day: 0, reward: 'a' })
    })

    test('rejected claim does not notify', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        await module.claimCurrentReward()
        expect(await module.claimCurrentReward()).toBe(false)
        expect(bridge.dailyRewardsClaimed).toHaveBeenCalledTimes(1)
    })

    test('missed-day reset notifies the platform bridge', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()

        bridge.clock.ms += 3 * MS_PER_DAY
        const module = createModule(bridge)

        expect(await module.getCurrentDay()).toBe(0)
        expect(bridge.dailyRewardsReset).toHaveBeenCalledWith({ day: 1 })
    })

    test('concurrent claims grant a single reward', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        const results = await Promise.all([
            module.claimCurrentReward(),
            module.claimCurrentReward(),
        ])

        expect(results.filter(Boolean)).toHaveLength(1)
        expect(bridge.dailyRewardsClaimed).toHaveBeenCalledTimes(1)
        expect(await module.getCurrentDay()).toBe(1)
    })

    test('concurrent refreshes send a single reset notification', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()

        bridge.clock.ms += 3 * MS_PER_DAY
        const module = createModule(bridge)

        await Promise.all([module.getCurrentDay(), module.getCurrentReward()])
        expect(bridge.dailyRewardsReset).toHaveBeenCalledTimes(1)
    })
})
