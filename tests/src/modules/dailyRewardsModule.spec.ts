import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import DailyRewardsModule from '../../../src/modules/daily-rewards/DailyRewardsModule'
import eventBus from '../../../src/lib/EventBus'
import bridgeConfig from '../../../src/lib/bridge-config'
import { MS_PER_DAY } from '../../../src/modules/daily-rewards/constants'
import { EVENT_NAME } from '../../../src/constants'
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

// A bridge with a movable server clock. Events are emitted on the global
// event bus, not on the bridge, so the bus emit is spied instead.
function createBridge() {
    const clock = { ms: BASE_MS }
    return {
        platformId: 'mock',
        getServerTime: vi.fn(() => Promise.resolve(clock.ms)),
        clock,
    }
}

const busEmit = vi.spyOn(eventBus, 'emit')

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new DailyRewardsModule().initialize(bridge as unknown as DailyRewardsBridgeContract)
}

function emitted(eventName: string) {
    return busEmit.mock.calls.filter(([name]) => name === eventName)
}

describe('DailyRewardsModule', () => {
    beforeEach(() => {
        store.clear()
        busEmit.mockClear()
        vi.mocked(bridgeConfig.getValues).mockReturnValue({
            dailyRewards: { rewards: ['a', 'b', 'c'] },
        })
    })

    test('successful claim emits the claimed event', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        expect(await module.claimCurrentReward()).toBe(true)
        expect(busEmit).toHaveBeenCalledWith(
            EVENT_NAME.DAILY_REWARDS_CLAIMED,
            { day: 0, reward: 'a' },
        )
    })

    test('same-day repeated claim is rejected and does not emit', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        await module.claimCurrentReward()
        expect(await module.claimCurrentReward()).toBe(false)
        expect(emitted(EVENT_NAME.DAILY_REWARDS_CLAIMED)).toHaveLength(1)
    })

    test('missed-day reset emits the streak reset event', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()

        bridge.clock.ms += 3 * MS_PER_DAY
        const module = createModule(bridge)

        expect(await module.getCurrentDay()).toBe(0)
        expect(busEmit).toHaveBeenCalledWith(
            EVENT_NAME.DAILY_REWARDS_STREAK_RESET,
            { day: 1 },
        )
    })

    test('concurrent claims grant a single reward', async () => {
        const bridge = createBridge()
        const module = createModule(bridge)

        const results = await Promise.all([
            module.claimCurrentReward(),
            module.claimCurrentReward(),
        ])

        expect(results.filter(Boolean)).toHaveLength(1)
        expect(emitted(EVENT_NAME.DAILY_REWARDS_CLAIMED)).toHaveLength(1)
        expect(await module.getCurrentDay()).toBe(1)
    })

    test('concurrent refreshes emit a single reset', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()

        bridge.clock.ms += 3 * MS_PER_DAY
        const module = createModule(bridge)

        await Promise.all([module.getCurrentDay(), module.getCurrentReward()])
        expect(emitted(EVENT_NAME.DAILY_REWARDS_STREAK_RESET)).toHaveLength(1)
    })

    test('claim racing a missed-day reset claims the first day', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()

        bridge.clock.ms += 3 * MS_PER_DAY
        const module = createModule(bridge)

        const [, claimed] = await Promise.all([
            module.getCurrentDay(),
            module.claimCurrentReward(),
        ])

        expect(claimed).toBe(true)
        expect(busEmit).toHaveBeenCalledWith(
            EVENT_NAME.DAILY_REWARDS_CLAIMED,
            { day: 0, reward: 'a' },
        )
        expect(emitted(EVENT_NAME.DAILY_REWARDS_STREAK_RESET)).toHaveLength(1)
    })

    test('single reward with cycle relies on the claim date alone', async () => {
        vi.mocked(bridgeConfig.getValues).mockReturnValue({
            dailyRewards: { rewards: ['a'] },
        })
        const bridge = createBridge()
        const module = createModule(bridge)

        expect(await module.claimCurrentReward()).toBe(true)
        expect(await module.getCurrentDay()).toBe(0)
        expect(await module.claimCurrentReward()).toBe(false)

        bridge.clock.ms += MS_PER_DAY
        expect(await createModule(bridge).claimCurrentReward()).toBe(true)
        expect(emitted(EVENT_NAME.DAILY_REWARDS_CLAIMED)).toHaveLength(2)
    })

    test('claiming the last reward wraps to the first day when cycle is on', async () => {
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()
        bridge.clock.ms += MS_PER_DAY
        await createModule(bridge).claimCurrentReward()
        bridge.clock.ms += MS_PER_DAY
        const module = createModule(bridge)

        expect(await module.claimCurrentReward()).toBe(true)
        expect(busEmit).toHaveBeenLastCalledWith(
            EVENT_NAME.DAILY_REWARDS_CLAIMED,
            { day: 2, reward: 'c' },
        )
        expect(await module.getCurrentDay()).toBe(0)
    })

    test('claims stop after the last reward when cycle is off', async () => {
        vi.mocked(bridgeConfig.getValues).mockReturnValue({
            dailyRewards: { rewards: ['a', 'b'], cycle: false },
        })
        const bridge = createBridge()
        await createModule(bridge).claimCurrentReward()
        bridge.clock.ms += MS_PER_DAY
        const module = createModule(bridge)

        expect(await module.claimCurrentReward()).toBe(true)
        expect(busEmit).toHaveBeenLastCalledWith(
            EVENT_NAME.DAILY_REWARDS_CLAIMED,
            { day: 1, reward: 'b' },
        )

        bridge.clock.ms += MS_PER_DAY
        expect(await createModule(bridge).claimCurrentReward()).toBe(false)
        expect(emitted(EVENT_NAME.DAILY_REWARDS_CLAIMED)).toHaveLength(2)
    })
})
