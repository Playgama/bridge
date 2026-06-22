import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import DailyChallengeModule from '../../../src/modules/daily-challenge/DailyChallengeModule'
import bridgeConfig from '../../../src/lib/bridge-config'
import { MS_PER_DAY } from '../../../src/modules/daily-challenge/constants'
import type {
    DailyChallengeBridgeContract,
    DailyChallengeConfig,
    QuestTemplate,
} from '../../../src/modules/daily-challenge/types'

// In-memory storage backing the mocked storage module. Cloned on read/write to
// mimic the JSON round-trip of real persistence (no shared references between
// module instances).
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

const POOL: QuestTemplate[] = [
    {
        id: 'a', metric: 'm1', target: 3, reward: 'ra',
    },
    {
        id: 'b', metric: 'm1', target: 2, reward: 'rb',
    },
    {
        id: 'c', metric: 'm2', target: 5, reward: 'rc',
    },
    {
        id: 'd', metric: 'm3', target: 1, reward: 'rd',
    },
]

const BASE_DAY = 100

function mockConfig(dailyChallenge?: DailyChallengeConfig) {
    vi.mocked(bridgeConfig.getValues).mockReturnValue(dailyChallenge ? { dailyChallenge } : {})
}

// A bridge whose server time can be moved day-by-day to drive roll-over.
function createBridge(startDay = BASE_DAY) {
    const clock = { day: startDay }
    const bridge = {
        platformId: 'mock',
        getServerTime: vi.fn(() => Promise.resolve(clock.day * MS_PER_DAY)),
        clock,
    }
    return bridge
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new DailyChallengeModule().initialize(bridge as unknown as DailyChallengeBridgeContract)
}

describe('DailyChallengeModule', () => {
    beforeEach(() => {
        store.clear()
        mockConfig(undefined)
    })

    describe('selection', () => {
        test('limits the active set to questsPerDay', async () => {
            mockConfig({ pool: POOL, questsPerDay: 2 })
            const quests = await createModule(createBridge()).getQuests()
            expect(quests).toHaveLength(2)
        })

        test('defaults to the whole pool when questsPerDay is omitted', async () => {
            mockConfig({ pool: POOL })
            const quests = await createModule(createBridge()).getQuests()
            expect(quests).toHaveLength(POOL.length)
        })

        test('random selection is deterministic for a given day (stable across instances)', async () => {
            mockConfig({ pool: POOL, questsPerDay: 2, selection: 'random' })

            const first = (await createModule(createBridge()).getQuests()).map((q) => q.id)
            store.clear() // force the second instance to roll over independently
            const second = (await createModule(createBridge()).getQuests()).map((q) => q.id)

            expect(second).toEqual(first)
        })

        test('sequential selection walks the pool across days', async () => {
            mockConfig({ pool: POOL, questsPerDay: 2, selection: 'sequential' })
            const bridge = createBridge()
            const module = createModule(bridge)

            const day100 = (await module.getQuests()).map((q) => q.id)
            bridge.clock.day += 1
            const day101 = (await module.getQuests()).map((q) => q.id)
            bridge.clock.day += 1
            const day102 = (await module.getQuests()).map((q) => q.id)

            expect(day100).toEqual(['a', 'b'])
            expect(day101).toEqual(['c', 'd'])
            expect(day102).toEqual(['a', 'b']) // cursor wrapped
        })

        test('exposes target and zeroed progress on a fresh day', async () => {
            mockConfig({ pool: POOL })
            const quests = await createModule(createBridge()).getQuests()
            const a = quests.find((q) => q.id === 'a')!
            expect(a).toMatchObject({
                metric: 'm1', target: 3, progress: 0, completed: false, claimed: false,
            })
        })
    })

    describe('reportProgress', () => {
        test('advances every active quest watching the metric', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            await module.reportProgress('m1', 1)
            const quests = await module.getQuests()

            expect(quests.find((q) => q.id === 'a')!.progress).toBe(1)
            expect(quests.find((q) => q.id === 'b')!.progress).toBe(1)
            expect(quests.find((q) => q.id === 'c')!.progress).toBe(0) // different metric
        })

        test('clamps progress to the target and never overshoots', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            await module.reportProgress('m1', 100)
            const quests = await module.getQuests()

            expect(quests.find((q) => q.id === 'a')!.progress).toBe(3) // target, not 100
            expect(quests.find((q) => q.id === 'a')!.completed).toBe(true)
        })

        test('returns the quests that became complete on this call', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            const firstHit = await module.reportProgress('m1', 2) // b (target 2) completes, a (target 3) not yet
            expect(firstHit.map((q) => q.id)).toEqual(['b'])

            const secondHit = await module.reportProgress('m1', 1) // a completes; b already complete
            expect(secondHit.map((q) => q.id)).toEqual(['a'])
        })

        test('is a no-op for an unwatched metric', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())
            expect(await module.reportProgress('unknown', 5)).toEqual([])
        })

        test('setProgress sets an absolute value, clamped to the target', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            const completed = await module.setProgress('m2', 999)
            expect(completed.map((q) => q.id)).toEqual(['c'])
            const quests = await module.getQuests()
            expect(quests.find((q) => q.id === 'c')!.progress).toBe(5)
        })
    })

    describe('claim guards', () => {
        test('claimReward fails when the quest is not complete', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())
            await module.reportProgress('m1', 1) // a at 1/3
            expect(await module.claimReward('a')).toBe(false)
        })

        test('claimReward succeeds once, then fails on a second claim', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())
            await module.reportProgress('m1', 3) // a complete

            expect(await module.claimReward('a')).toBe(true)
            expect(await module.claimReward('a')).toBe(false)
        })

        test('claimReward fails for an unknown quest id', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())
            expect(await module.claimReward('does_not_exist')).toBe(false)
        })

        test('getCurrentReward returns the reward only while completed and unclaimed', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            expect(await module.getCurrentReward('a')).toBeNull() // not complete
            await module.reportProgress('m1', 3)
            expect(await module.getCurrentReward('a')).toBe('ra') // complete, unclaimed
            await module.claimReward('a')
            expect(await module.getCurrentReward('a')).toBeNull() // claimed
        })
    })

    describe('daily roll-over', () => {
        test('resets progress and claimed state when the day changes', async () => {
            mockConfig({ pool: POOL })
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.reportProgress('m1', 3)
            await module.claimReward('a')

            bridge.clock.day += 1
            const quests = await module.getQuests()
            const a = quests.find((q) => q.id === 'a')!
            expect(a.progress).toBe(0)
            expect(a.claimed).toBe(false)
        })

        test('does not reset within the same day', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())

            await module.reportProgress('m1', 2)
            const quests = await module.getQuests() // same day, no roll-over
            expect(quests.find((q) => q.id === 'a')!.progress).toBe(2)
        })

        test('persists progress across module instances on the same day', async () => {
            mockConfig({ pool: POOL })
            await createModule(createBridge()).reportProgress('m1', 2)

            // A fresh instance loads the persisted state from storage.
            const quests = await createModule(createBridge()).getQuests()
            expect(quests.find((q) => q.id === 'a')!.progress).toBe(2)
        })
    })

    describe('setQuestPool', () => {
        test('runtime pool overrides the config pool', async () => {
            mockConfig({ pool: POOL })
            const module = createModule(createBridge())
            module.setQuestPool([{
                id: 'x', metric: 'mx', target: 1, reward: 'rx',
            }])

            const quests = await module.getQuests()
            expect(quests.map((q) => q.id)).toEqual(['x'])
        })
    })

    describe('empty / malformed config', () => {
        test('returns no quests when the pool is missing', async () => {
            mockConfig(undefined)
            expect(await createModule(createBridge()).getQuests()).toEqual([])
        })
    })
})
