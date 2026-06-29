import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import TasksModule from '../../../src/modules/tasks/TasksModule'
import bridgeConfig from '../../../src/lib/bridge-config'
import { MS_PER_DAY, MS_PER_WEEK } from '../../../src/modules/tasks/constants'
import type {
    TasksBridgeContract,
    TasksConfig,
} from '../../../src/modules/tasks/types'

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

function mockConfig(tasks?: TasksConfig) {
    vi.mocked(bridgeConfig.getValues).mockReturnValue(tasks ? { tasks } : {})
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
    return new TasksModule().initialize(bridge as unknown as TasksBridgeContract)
}

// One daily group: a single-target task and a two-target task.
const DAILY_CONFIG: TasksConfig = [{
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

function find(tasks: Awaited<ReturnType<TasksModule['getTasks']>>, id: string) {
    return tasks.find((t) => t.id === id)!
}

describe('TasksModule', () => {
    beforeEach(() => {
        store.clear()
        mockConfig(undefined)
    })

    describe('getTasks', () => {
        test('returns all items in a group (no selection), tagged with the group type', async () => {
            mockConfig(DAILY_CONFIG)
            const tasks = await createModule(createBridge()).getTasks()
            expect(tasks.map((t) => t.id)).toEqual(['kills', 'combo'])
            expect(tasks.every((t) => t.type === 'daily')).toBe(true)
        })

        test('exposes targets with amount, zeroed progress, and rewards', async () => {
            mockConfig(DAILY_CONFIG)
            const kills = find(await createModule(createBridge()).getTasks(), 'kills')
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
            const kills = find(await module.getTasks(), 'kills')
            expect(kills.targets[0].progress).toBe(20)
            expect(kills.completed).toBe(true)
        })

        test('only touches targets watching the reported metric', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 2)
            const combo = find(await module.getTasks(), 'combo')
            expect(combo.targets.find((t) => t.id === 'kill')!.progress).toBe(2)
            expect(combo.targets.find((t) => t.id === 'coin')!.progress).toBe(0)
        })

        test('multi-target task completes only when ALL targets are met (AND)', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())

            await module.addProgress('kill', 3) // one target met
            expect(find(await module.getTasks(), 'combo').completed).toBe(false) // coin still 0

            await module.addProgress('coin', 100) // second target met
            expect(find(await module.getTasks(), 'combo').completed).toBe(true) // now complete
        })

        test('is a no-op for an unwatched metric', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('unknown', 5)
            expect(find(await module.getTasks(), 'kills').targets[0].progress).toBe(0)
        })

        test('one report fans out across all active task types', async () => {
            mockConfig([
                { id: 'daily', type: 'daily', items: [{ id: 'qd', targets: [{ id: 'm', amount: 5 }], rewards: [] }] },
                { id: 'weekly', type: 'weekly', items: [{ id: 'qw', targets: [{ id: 'm', amount: 5 }], rewards: [] }] },
            ])
            const module = createModule(createBridge())
            await module.addProgress('m', 1)
            const tasks = await module.getTasks()
            expect(find(tasks, 'qd').targets[0].progress).toBe(1)
            expect(find(tasks, 'qw').targets[0].progress).toBe(1)
        })
    })

    describe('claimReward', () => {
        test('returns true once the task is complete', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 3)
            await module.addProgress('coin', 100)

            expect(await module.claimReward('combo')).toBe(true)
        })

        test('returns false while the task is incomplete', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('kill', 3) // combo still missing the coin target
            expect(await module.claimReward('combo')).toBe(false)
        })

        test('cannot be claimed twice', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.addProgress('enemy_killed', 20)

            expect(await module.claimReward('kills')).toBe(true)
            expect(await module.claimReward('kills')).toBe(false)
        })

        test('returns false for an unknown task id', async () => {
            mockConfig(DAILY_CONFIG)
            expect(await createModule(createBridge()).claimReward('nope')).toBe(false)
        })
    })

    describe('types', () => {
        test('weekly does not reset within the same week but does across weeks', async () => {
            mockConfig([{ id: 'weekly', type: 'weekly', items: [{ id: 'wk', targets: [{ id: 'm', amount: 5 }], rewards: [] }] }])
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.addProgress('m', 2)
            bridge.clock.ms += MS_PER_DAY // same week
            expect(find(await module.getTasks(), 'wk').targets[0].progress).toBe(2)

            bridge.clock.ms += MS_PER_WEEK // next week
            expect(find(await module.getTasks(), 'wk').targets[0].progress).toBe(0)
        })

        test('permanent never resets', async () => {
            mockConfig([{ id: 'perm', type: 'permanent', items: [{ id: 'pm', targets: [{ id: 'm', amount: 5 }], rewards: [] }] }])
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.addProgress('m', 3)
            bridge.clock.ms += 30 * MS_PER_DAY
            expect(find(await module.getTasks(), 'pm').targets[0].progress).toBe(3)
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
            const kills = find(await module.getTasks(), 'kills')
            expect(kills.targets[0].progress).toBe(0)
            expect(kills.claimed).toBe(false)
        })

        test('partial progress persists across module instances in the same period', async () => {
            mockConfig(DAILY_CONFIG)
            await createModule(createBridge()).addProgress('enemy_killed', 7) // does not complete

            const kills = find(await createModule(createBridge()).getTasks(), 'kills')
            expect(kills.targets[0].progress).toBe(7)
        })
    })

    describe('empty / malformed config', () => {
        test('returns no tasks when config is missing', async () => {
            mockConfig(undefined)
            expect(await createModule(createBridge()).getTasks()).toEqual([])
        })

        test('ignores groups with an unknown type', async () => {
            mockConfig([{ id: 'm', type: 'monthly' as never, items: [{ id: 'x', targets: [{ id: 'm', amount: 1 }], rewards: [] }] }])
            expect(await createModule(createBridge()).getTasks()).toEqual([])
        })
    })
})
