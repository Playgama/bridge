import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import QuestsModule from '../../../src/modules/quests/QuestsModule'
import bridgeConfig from '../../../src/lib/bridge-config'
import { MS_PER_DAY, MS_PER_WEEK } from '../../../src/modules/quests/constants'
import type {
    QuestsBridgeContract,
    QuestsConfig,
} from '../../../src/modules/quests/types'

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

// Day 100, comfortably mid-week (week 14 spans days 98..104).
const BASE_MS = 100 * MS_PER_DAY

function mockConfig(quests?: QuestsConfig) {
    vi.mocked(bridgeConfig.getValues).mockReturnValue(quests ? { quests } : {})
}

// A bridge whose server time can be moved to drive roll-over.
function createBridge(ms = BASE_MS) {
    const clock = { ms }
    const bridge = {
        platformId: 'mock',
        getServerTime: vi.fn(() => Promise.resolve(clock.ms)),
        clock,
    }
    return bridge
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new QuestsModule().initialize(bridge as unknown as QuestsBridgeContract)
}

// One daily group: a single-target quest and a two-target quest.
const DAILY_CONFIG: QuestsConfig = [{
    id: 'daily',
    type: 'daily',
    items: [
        {
            id: 'kills',
            targets: [{ id: 'enemy_killed', amount: 20 }],
            rewards: [{ id: 'gold', amount: 500 }],
        },
        {
            id: 'combo',
            targets: [{ id: 'kill', amount: 3 }, { id: 'coin', amount: 100 }],
            rewards: [{ id: 'gem', amount: 1 }, { id: 'gold', amount: 50 }],
        },
    ],
}]

function find(quests: Awaited<ReturnType<QuestsModule['getQuests']>>, id: string) {
    return quests.find((q) => q.id === id)!
}

describe('QuestsModule', () => {
    beforeEach(() => {
        store.clear()
        mockConfig(undefined)
    })

    describe('getQuests', () => {
        test('returns all items in a group (no selection), tagged with the group type', async () => {
            mockConfig(DAILY_CONFIG)
            const quests = await createModule(createBridge()).getQuests()
            expect(quests.map((q) => q.id)).toEqual(['kills', 'combo'])
            expect(quests.every((q) => q.type === 'daily')).toBe(true)
        })

        test('exposes targets with amount, zeroed progress, and rewards', async () => {
            mockConfig(DAILY_CONFIG)
            const kills = find(await createModule(createBridge()).getQuests(), 'kills')
            expect(kills.targets).toEqual([
                {
                    id: 'enemy_killed', amount: 20, progress: 0, completed: false,
                },
            ])
            expect(kills.rewards).toEqual([{ id: 'gold', amount: 500 }])
            expect(kills.completed).toBe(false)
            expect(kills.claimed).toBe(false)
        })
    })

    describe('addProgress', () => {
        test('advances the matching target and clamps to its amount', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('enemy_killed', 999)
            const kills = find(await module.getQuests(), 'kills')
            expect(kills.targets[0].progress).toBe(20)
            expect(kills.completed).toBe(true)
        })

        test('only touches targets watching the reported metric', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 2)
            const combo = find(await module.getQuests(), 'combo')
            expect(combo.targets.find((t) => t.id === 'kill')!.progress).toBe(2)
            expect(combo.targets.find((t) => t.id === 'coin')!.progress).toBe(0)
        })

        test('multi-target quest completes only when ALL targets are met (AND)', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())

            const afterKills = await module.addProgress('kill', 3) // one target met
            expect(afterKills).toEqual([]) // combo not complete yet (coin still 0)

            const afterCoins = await module.addProgress('coin', 100) // second target met
            expect(afterCoins.map((q) => q.id)).toEqual(['combo']) // now complete
            expect(find(await module.getQuests(), 'combo').completed).toBe(true)
        })

        test('is a no-op for an unwatched metric', async () => {
            mockConfig(DAILY_CONFIG)
            expect(await createModule(createBridge()).addProgress('unknown', 5)).toEqual([])
        })

        test('one report fans out across all active quest types', async () => {
            mockConfig([
                { id: 'daily', type: 'daily', items: [{ id: 'qd', targets: [{ id: 'm', amount: 5 }], rewards: [] }] },
                { id: 'weekly', type: 'weekly', items: [{ id: 'qw', targets: [{ id: 'm', amount: 5 }], rewards: [] }] },
            ])
            const module = createModule(createBridge())
            await module.addProgress('m', 1)
            const quests = await module.getQuests()
            expect(find(quests, 'qd').targets[0].progress).toBe(1)
            expect(find(quests, 'qw').targets[0].progress).toBe(1)
        })
    })

    describe('claimReward', () => {
        test('returns the rewards once the quest is complete', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 3)
            await module.addProgress('coin', 100)

            expect(await module.claimReward('combo')).toEqual([
                { id: 'gem', amount: 1 },
                { id: 'gold', amount: 50 },
            ])
        })

        test('returns null while the quest is incomplete', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 3) // combo still missing the coin target
            expect(await module.claimReward('combo')).toBeNull()
        })

        test('cannot be claimed twice', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('enemy_killed', 20)

            expect(await module.claimReward('kills')).toEqual([{ id: 'gold', amount: 500 }])
            expect(await module.claimReward('kills')).toBeNull()
        })

        test('returns null for an unknown quest id', async () => {
            mockConfig(DAILY_CONFIG)
            expect(await createModule(createBridge()).claimReward('nope')).toBeNull()
        })
    })

    describe('types', () => {
        test('weekly does not reset within the same week but does across weeks', async () => {
            mockConfig([{ id: 'weekly', type: 'weekly', items: [{ id: 'wk', targets: [{ id: 'm', amount: 5 }], rewards: [] }] }])
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.addProgress('m', 2)
            bridge.clock.ms += MS_PER_DAY // same week
            expect(find(await module.getQuests(), 'wk').targets[0].progress).toBe(2)

            bridge.clock.ms += MS_PER_WEEK // next week
            expect(find(await module.getQuests(), 'wk').targets[0].progress).toBe(0)
        })

        test('permanent never resets', async () => {
            mockConfig([{ id: 'perm', type: 'permanent', items: [{ id: 'pm', targets: [{ id: 'm', amount: 5 }], rewards: [] }] }])
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.addProgress('m', 3)
            bridge.clock.ms += 30 * MS_PER_DAY
            expect(find(await module.getQuests(), 'pm').targets[0].progress).toBe(3)
        })
    })

    describe('roll-over & persistence', () => {
        test('daily roll-over resets progress and claimed state', async () => {
            mockConfig(DAILY_CONFIG)
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.addProgress('enemy_killed', 20)
            await module.claimReward('kills')

            bridge.clock.ms += MS_PER_DAY
            const kills = find(await module.getQuests(), 'kills')
            expect(kills.targets[0].progress).toBe(0)
            expect(kills.claimed).toBe(false)
        })

        test('partial progress persists across module instances in the same period', async () => {
            mockConfig(DAILY_CONFIG)
            await createModule(createBridge()).addProgress('enemy_killed', 7) // does not complete

            const kills = find(await createModule(createBridge()).getQuests(), 'kills')
            expect(kills.targets[0].progress).toBe(7)
        })
    })

    describe('empty / malformed config', () => {
        test('returns no quests when config is missing', async () => {
            mockConfig(undefined)
            expect(await createModule(createBridge()).getQuests()).toEqual([])
        })

        test('ignores groups with an unknown type', async () => {
            mockConfig([{ id: 'm', type: 'monthly' as never, items: [{ id: 'x', targets: [{ id: 'm', amount: 1 }], rewards: [] }] }])
            expect(await createModule(createBridge()).getQuests()).toEqual([])
        })
    })
})
