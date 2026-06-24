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

const DAILY_CONFIG: QuestsConfig = {
    groups: [{
        cadence: 'daily',
        pool: [
            {
                id: 'd1', metric: 'm1', target: 3, reward: 'r_d1',
            },
            {
                id: 'd2', metric: 'm1', target: 2, reward: 'r_d2',
            },
            {
                id: 'd3', metric: 'm2', target: 5, reward: 'r_d3',
            },
        ],
    }],
}

describe('QuestsModule', () => {
    beforeEach(() => {
        store.clear()
        mockConfig(undefined)
    })

    describe('selection', () => {
        test('returns active quests tagged with their cadence and zeroed progress', async () => {
            mockConfig(DAILY_CONFIG)
            const quests = await createModule(createBridge()).getQuests()
            const d1 = quests.find((q) => q.id === 'd1')!
            expect(d1).toMatchObject({
                cadence: 'daily', metric: 'm1', target: 3, progress: 0, completed: false, claimed: false,
            })
        })

        test('limits a group to its count', async () => {
            mockConfig({ groups: [{ cadence: 'daily', count: 2, pool: DAILY_CONFIG.groups[0].pool }] })
            expect(await createModule(createBridge()).getQuests()).toHaveLength(2)
        })

        test('random selection is deterministic for a period (stable across instances)', async () => {
            mockConfig({
                groups: [{
                    cadence: 'daily', count: 2, selection: 'random', pool: DAILY_CONFIG.groups[0].pool,
                }],
            })

            const first = (await createModule(createBridge()).getQuests()).map((q) => q.id)
            store.clear()
            const second = (await createModule(createBridge()).getQuests()).map((q) => q.id)

            expect(second).toEqual(first)
        })

        test('sequential selection walks the pool across days', async () => {
            mockConfig({
                groups: [{
                    cadence: 'daily', count: 2, selection: 'sequential', pool: DAILY_CONFIG.groups[0].pool,
                }],
            })
            const bridge = createBridge()
            const module = createModule(bridge)

            const day100 = (await module.getQuests()).map((q) => q.id)
            bridge.clock.ms += MS_PER_DAY
            const day101 = (await module.getQuests()).map((q) => q.id)

            expect(day100).toEqual(['d1', 'd2'])
            expect(day101).toEqual(['d3', 'd1']) // wraps
        })
    })

    describe('cadences', () => {
        test('weekly does not reset within the same week but does across weeks', async () => {
            mockConfig({
                groups: [{
                    cadence: 'weekly',
                    pool: [{
                        id: 'wk', metric: 'm', target: 5, reward: 'rwk',
                    }],
                }],
            })
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.reportProgress('m', 2)
            bridge.clock.ms += MS_PER_DAY // same week
            expect((await module.getQuests()).find((q) => q.id === 'wk')!.progress).toBe(2)

            bridge.clock.ms += MS_PER_WEEK // next week
            expect((await module.getQuests()).find((q) => q.id === 'wk')!.progress).toBe(0)
        })

        test('permanent never resets', async () => {
            mockConfig({
                groups: [{
                    cadence: 'permanent',
                    pool: [{
                        id: 'pm', metric: 'm', target: 5, reward: 'rpm',
                    }],
                }],
            })
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.reportProgress('m', 3)
            bridge.clock.ms += 30 * MS_PER_DAY
            expect((await module.getQuests()).find((q) => q.id === 'pm')!.progress).toBe(3)
        })

        test('event quests are present only inside the window', async () => {
            mockConfig({
                groups: [{
                    cadence: 'event',
                    window: { start: BASE_MS - MS_PER_DAY, end: BASE_MS + MS_PER_DAY },
                    pool: [{
                        id: 'ev', metric: 'm', target: 2, reward: 'rev',
                    }],
                }],
            })
            const bridge = createBridge()
            const module = createModule(bridge)

            expect((await module.getQuests()).map((q) => q.id)).toEqual(['ev']) // inside

            bridge.clock.ms = BASE_MS + 2 * MS_PER_DAY // past the end
            expect(await module.getQuests()).toEqual([])
        })

        test('a completed event reward cannot be claimed after the window ends', async () => {
            mockConfig({
                groups: [{
                    cadence: 'event',
                    window: { start: BASE_MS - MS_PER_DAY, end: BASE_MS + MS_PER_DAY },
                    pool: [{
                        id: 'ev', metric: 'm', target: 1, reward: 'rev',
                    }],
                }],
            })
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.reportProgress('m', 1) // ev complete, unclaimed
            bridge.clock.ms = BASE_MS + 2 * MS_PER_DAY
            expect(await module.claimReward('ev')).toBe(false)
        })

        test('one reportProgress fans out across all active cadences', async () => {
            mockConfig({
                groups: [
                    {
                        cadence: 'daily',
                        id: 'd',
                        pool: [{
                            id: 'qd', metric: 'm', target: 5, reward: 'rd',
                        }],
                    },
                    {
                        cadence: 'weekly',
                        id: 'w',
                        pool: [{
                            id: 'qw', metric: 'm', target: 5, reward: 'rw',
                        }],
                    },
                ],
            })
            const module = createModule(createBridge())

            await module.reportProgress('m', 1)
            const quests = await module.getQuests()

            expect(quests.find((q) => q.id === 'qd')!.progress).toBe(1)
            expect(quests.find((q) => q.id === 'qw')!.progress).toBe(1)
        })
    })

    describe('anchor', () => {
        const HOUR = MS_PER_DAY / 24

        test('player anchor keeps a full day from first play while calendar resets at the UTC boundary', async () => {
            mockConfig({
                groups: [
                    {
                        cadence: 'daily',
                        id: 'cal',
                        pool: [{
                            id: 'c', metric: 'm', target: 5, reward: 'rc',
                        }],
                    },
                    {
                        cadence: 'daily',
                        id: 'plr',
                        anchor: 'player',
                        pool: [{
                            id: 'p', metric: 'm', target: 5, reward: 'rp',
                        }],
                    },
                ],
            })
            // First play at 12:00 UTC; the player anchor is captured here.
            const bridge = createBridge(BASE_MS + 12 * HOUR)
            const module = createModule(bridge)

            await module.reportProgress('m', 2)

            // 13h later we have crossed the next UTC midnight, but only 13h of the
            // player's 24h window have elapsed.
            bridge.clock.ms = BASE_MS + 25 * HOUR
            const quests = await module.getQuests()

            expect(quests.find((q) => q.id === 'c')!.progress).toBe(0) // calendar reset
            expect(quests.find((q) => q.id === 'p')!.progress).toBe(2) // player window intact
        })

        test('player anchor resets a full day after first play', async () => {
            mockConfig({
                groups: [{
                    cadence: 'daily',
                    id: 'plr',
                    anchor: 'player',
                    pool: [{
                        id: 'p', metric: 'm', target: 5, reward: 'rp',
                    }],
                }],
            })
            const bridge = createBridge(BASE_MS + 12 * HOUR)
            const module = createModule(bridge)

            await module.reportProgress('m', 2)
            bridge.clock.ms = BASE_MS + 12 * HOUR + MS_PER_DAY // exactly 24h after first play
            expect((await module.getQuests()).find((q) => q.id === 'p')!.progress).toBe(0)
        })

        test('the captured anchor persists across module instances', async () => {
            mockConfig({
                groups: [{
                    cadence: 'daily',
                    id: 'plr',
                    anchor: 'player',
                    pool: [{
                        id: 'p', metric: 'm', target: 5, reward: 'rp',
                    }],
                }],
            })
            // First instance captures the anchor at 12:00 UTC and makes progress.
            await createModule(createBridge(BASE_MS + 12 * HOUR)).reportProgress('m', 2)

            // A later instance, past the next UTC midnight but inside the player's
            // first 24h, must reuse the stored anchor and keep progress.
            const quests = await createModule(createBridge(BASE_MS + 25 * HOUR)).getQuests()
            expect(quests.find((q) => q.id === 'p')!.progress).toBe(2)
        })
    })

    describe('segmentation (Pattern A)', () => {
        const SEG_CONFIG: QuestsConfig = {
            groups: [{
                cadence: 'daily',
                pool: [
                    {
                        id: 'easy', metric: 'coin', target: 10, reward: 'r_easy', conditions: { level: { max: 9 } },
                    },
                    {
                        id: 'hard', metric: 'coin', target: 1000, reward: 'r_hard', conditions: { level: { min: 10 } },
                    },
                ],
            }],
        }

        test('selects the high-level quest for an experienced player', async () => {
            mockConfig(SEG_CONFIG)
            const module = createModule(createBridge())
            module.setPlayerContext({ level: 12 })
            expect((await module.getQuests()).map((q) => q.id)).toEqual(['hard'])
        })

        test('selects the low-level quest for a new player', async () => {
            mockConfig(SEG_CONFIG)
            const module = createModule(createBridge())
            module.setPlayerContext({ level: 5 })
            expect((await module.getQuests()).map((q) => q.id)).toEqual(['easy'])
        })

        test('fails closed: a conditioned quest is excluded when context is missing', async () => {
            mockConfig(SEG_CONFIG)
            const module = createModule(createBridge())
            expect(await module.getQuests()).toEqual([]) // no setPlayerContext call
        })

        test('supports eq / in conditions', async () => {
            mockConfig({
                groups: [{
                    cadence: 'daily',
                    pool: [
                        {
                            id: 'us', metric: 'm', target: 1, reward: 'r', conditions: { region: { eq: 'US' } },
                        },
                        {
                            id: 'eu', metric: 'm', target: 1, reward: 'r', conditions: { region: { in: ['DE', 'FR'] } },
                        },
                    ],
                }],
            })
            const module = createModule(createBridge())
            module.setPlayerContext({ region: 'FR' })
            expect((await module.getQuests()).map((q) => q.id)).toEqual(['eu'])
        })

        test('locks the selected set for the period even if context changes mid-period', async () => {
            mockConfig(SEG_CONFIG)
            const module = createModule(createBridge())
            module.setPlayerContext({ level: 5 })
            await module.getQuests() // rolls over -> 'easy' locked for the day

            module.setPlayerContext({ level: 50 })
            expect((await module.getQuests()).map((q) => q.id)).toEqual(['easy']) // unchanged this period
        })
    })

    describe('reportProgress', () => {
        test('clamps progress to the target', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            await module.reportProgress('m1', 100)
            expect((await module.getQuests()).find((q) => q.id === 'd1')!.progress).toBe(3)
        })

        test('returns the quests that became complete on this call', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())

            expect((await module.reportProgress('m1', 2)).map((q) => q.id)).toEqual(['d2']) // target 2
            expect((await module.reportProgress('m1', 1)).map((q) => q.id)).toEqual(['d1']) // target 3
        })

        test('is a no-op for an unwatched metric', async () => {
            mockConfig(DAILY_CONFIG)
            expect(await createModule(createBridge()).reportProgress('unknown', 5)).toEqual([])
        })

        test('setProgress sets an absolute value, clamped', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())
            expect((await module.setProgress('m2', 999)).map((q) => q.id)).toEqual(['d3'])
            expect((await module.getQuests()).find((q) => q.id === 'd3')!.progress).toBe(5)
        })
    })

    describe('claim guards', () => {
        test('claimReward fails until complete, succeeds once, then fails again', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())

            await module.reportProgress('m1', 1) // d1 at 1/3
            expect(await module.claimReward('d1')).toBe(false)

            await module.reportProgress('m1', 2) // d1 complete
            expect(await module.claimReward('d1')).toBe(true)
            expect(await module.claimReward('d1')).toBe(false)
        })

        test('claimReward fails for an unknown quest id', async () => {
            mockConfig(DAILY_CONFIG)
            expect(await createModule(createBridge()).claimReward('nope')).toBe(false)
        })

        test('getCurrentReward returns the reward only while completed and unclaimed', async () => {
            mockConfig(DAILY_CONFIG)
            const module = createModule(createBridge())

            expect(await module.getCurrentReward('d1')).toBeNull()
            await module.reportProgress('m1', 3)
            expect(await module.getCurrentReward('d1')).toBe('r_d1')
            await module.claimReward('d1')
            expect(await module.getCurrentReward('d1')).toBeNull()
        })
    })

    describe('roll-over & persistence', () => {
        test('daily roll-over resets progress and claimed state', async () => {
            mockConfig(DAILY_CONFIG)
            const bridge = createBridge()
            const module = createModule(bridge)

            await module.reportProgress('m1', 3)
            await module.claimReward('d1')

            bridge.clock.ms += MS_PER_DAY
            const d1 = (await module.getQuests()).find((q) => q.id === 'd1')!
            expect(d1.progress).toBe(0)
            expect(d1.claimed).toBe(false)
        })

        test('progress persists across module instances in the same period', async () => {
            mockConfig(DAILY_CONFIG)
            await createModule(createBridge()).reportProgress('m1', 2)

            const quests = await createModule(createBridge()).getQuests()
            expect(quests.find((q) => q.id === 'd1')!.progress).toBe(2)
        })
    })

    describe('empty / malformed config', () => {
        test('returns no quests when there are no groups', async () => {
            mockConfig(undefined)
            expect(await createModule(createBridge()).getQuests()).toEqual([])
        })

        test('ignores groups with an unknown cadence', async () => {
            mockConfig({
                groups: [{
                    cadence: 'monthly' as never,
                    pool: [{
                        id: 'x', metric: 'm', target: 1, reward: 'r',
                    }],
                }],
            })
            expect(await createModule(createBridge()).getQuests()).toEqual([])
        })
    })
})
