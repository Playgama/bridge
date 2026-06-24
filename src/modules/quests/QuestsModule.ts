/*
 * This file is part of Playgama Bridge.
 *
 * Playgama Bridge is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * Playgama Bridge is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Playgama Bridge. If not, see <https://www.gnu.org/licenses/>.
 */

import ModuleBase from '../ModuleBase'
import { type AnyRecord, seededShuffle } from '../../utils'
import bridgeConfig from '../../lib/bridge-config'
import storageModule from '../storage'
import {
    QUESTS_STORAGE_KEY,
    MS_PER_DAY,
    MS_PER_WEEK,
    CADENCE,
    CADENCE_SEED_SALT,
    PERMANENT_PERIOD,
    SELECTION_MODE,
    ANCHOR,
} from './constants'
import type {
    QuestsState,
    GroupState,
    QuestsBridgeContract,
    Quest,
    QuestProgress,
    QuestTemplate,
    QuestGroupConfig,
    PlayerContext,
} from './types'

/**
 * Quests module. The game configures one or more quest groups, each with a
 * cadence — 'daily' / 'weekly' (reset every UTC day/week), 'permanent' (never
 * resets), or 'event' (active only within a configured time window). Each period
 * the module picks an active set per group (deterministically random, seeded by
 * the period, or sequential) and resets its progress. The game reports gameplay
 * via reportProgress(metric); the module advances every matching active quest
 * across all cadences, persists through the storage module, and exposes claim
 * state.
 *
 * Player segmentation (Pattern A): each quest may carry data-only `conditions`
 * (e.g. { level: { min: 10 } }); the game supplies attribute values through
 * setPlayerContext(). Eligibility is evaluated at roll-over and then locked for
 * the period, so set the context before the first read of a period.
 *
 * The module is data-only: it tracks numbers, not meaning. Display text and what
 * a reward grants are owned by the game, keyed off the metric/reward ids. Quest
 * ids must be unique across all groups.
 */
class QuestsModule extends ModuleBase<QuestsBridgeContract> {
    #groups: QuestGroupConfig[] = []

    #playerContext: PlayerContext = {}

    #state: QuestsState | null = null

    #loadPromise: Promise<QuestsState> | null = null

    initialize(platformBridge: QuestsBridgeContract): this {
        super.initialize(platformBridge)

        // SaaS hook point. To add a server-authoritative (cheat-resistant) backend
        // later, follow the LeaderboardsModule pattern: when this._isSaas(MODULE_NAME.
        // QUESTS) is true, create a SaasRequest client here and branch each public
        // method to relay through it (getQuests -> GET, reportProgress/claimReward
        // -> POST). The server then owns the pool, selection, segmentation, and claim
        // validation, so the local config below stays dormant as the no-SaaS fallback.
        // The public API and Quest shape are unchanged.

        const config = bridgeConfig.getValues().quests
        this.#groups = Array.isArray(config?.groups)
            ? config!.groups.filter((group) => this.#isValidGroup(group))
            : []
        return this
    }

    // Sets the player attributes used to evaluate quest conditions. Call before the
    // first read of a period so the right quests are selected at roll-over.
    // Accumulates across calls.
    setPlayerContext(context: PlayerContext): void {
        if (context && typeof context === 'object') {
            this.#playerContext = { ...this.#playerContext, ...context }
        }
    }

    // Every currently-active quest across all groups, joined with live progress.
    async getQuests(): Promise<Quest[]> {
        const { state, active } = await this.#sync()
        const result: Quest[] = []
        active.forEach(({ group, key }) => {
            state.groups[key].quests.forEach((quest) => {
                const template = this.#findTemplate(group, quest.id)
                if (template) {
                    result.push(this.#buildQuest(group, quest, template))
                }
            })
        })
        return result
    }

    // Increments every active, incomplete quest watching `metric` by `amount`
    // (clamped to its target), across all cadences. Returns the quests that became
    // complete on this call. No-op metrics return [].
    async reportProgress(metric: string, amount = 1): Promise<Quest[]> {
        return this.#advance(metric, (quest, template) => Math.min(quest.progress + amount, template.target))
    }

    // Sets the absolute progress for every active quest watching `metric` (clamped
    // to its target). Returns the quests that became complete on this call.
    async setProgress(metric: string, value: number): Promise<Quest[]> {
        return this.#advance(metric, (_quest, template) => Math.min(value, template.target))
    }

    // Reward id of a completed-but-unclaimed active quest, or null if not claimable.
    async getCurrentReward(questId: string): Promise<string | null> {
        const { state, active } = await this.#sync()
        const found = this.#findQuestEntry(active, state, questId)
        if (!found || found.quest.claimed) {
            return null
        }
        const template = this.#findTemplate(found.group, found.quest.id)
        if (!template || found.quest.progress < template.target) {
            return null
        }
        return template.reward
    }

    // Marks a completed active quest's reward as claimed. Returns false when the
    // quest is not currently active, not complete, or already claimed.
    async claimReward(questId: string): Promise<boolean> {
        const { state, active } = await this.#sync()
        const found = this.#findQuestEntry(active, state, questId)
        if (!found || found.quest.claimed) {
            return false
        }
        const template = this.#findTemplate(found.group, found.quest.id)
        if (!template || found.quest.progress < template.target) {
            return false
        }

        found.quest.claimed = true
        await this.#persist()
        return true
    }

    async #advance(
        metric: string,
        next: (quest: QuestProgress, template: QuestTemplate) => number,
    ): Promise<Quest[]> {
        const { state, active } = await this.#sync()
        const justCompleted: Quest[] = []
        let changed = false

        active.forEach(({ group, key }) => {
            const { quests } = state.groups[key]
            quests.forEach((quest, index) => {
                const template = this.#findTemplate(group, quest.id)
                if (!template || template.metric !== metric) {
                    return
                }

                const previous = quest.progress
                const wasCompleted = previous >= template.target
                const updated = quests[index]
                updated.progress = Math.max(0, next(quest, template))

                if (updated.progress !== previous) {
                    changed = true
                }
                if (!wasCompleted && updated.progress >= template.target) {
                    justCompleted.push(this.#buildQuest(group, updated, template))
                }
            })
        })

        if (changed) {
            await this.#persist()
        }
        return justCompleted
    }

    // Loads state, then for every group whose cadence is currently active, rolls
    // over to a fresh selection when its period changed. Returns the state and the
    // list of active groups so callers only ever touch live quests.
    async #sync(): Promise<{ state: QuestsState, active: { group: QuestGroupConfig, key: string }[] }> {
        const state = await this.#load()
        const now = await this.#getNow()
        const active: { group: QuestGroupConfig, key: string }[] = []
        let dirty = false

        this.#groups.forEach((group, index) => {
            const key = this.#groupKey(group, index)

            // Player-anchored groups capture their first-play timestamp once; the
            // period is then measured relative to it. Calendar groups use anchor 0,
            // which leaves the period math on the shared UTC boundary.
            let anchorMs = 0
            if (this.#isPlayerAnchored(group)) {
                if (typeof state.anchors[key] !== 'number') {
                    state.anchors[key] = now
                    dirty = true
                }
                anchorMs = state.anchors[key]
            }

            const period = this.#periodKey(group, now, anchorMs)
            if (period === null) {
                return
            }

            const current = state.groups[key]
            if (!current || current.periodKey !== period) {
                state.groups[key] = this.#selectQuests(group, period, current?.poolCursor ?? 0)
                dirty = true
            }
            active.push({ group, key })
        })

        if (dirty) {
            await this.#persist()
        }
        return { state, active }
    }

    // The period number a group belongs to right now, or null when the cadence is
    // currently inactive (an event outside its window). A change vs. the stored
    // value triggers a roll-over.
    #periodKey(group: QuestGroupConfig, now: number, anchorMs: number): number | null {
        switch (group.cadence) {
            case CADENCE.DAILY:
                return Math.floor((now - anchorMs) / MS_PER_DAY)
            case CADENCE.WEEKLY:
                return Math.floor((now - anchorMs) / MS_PER_WEEK)
            case CADENCE.PERMANENT:
                return PERMANENT_PERIOD
            case CADENCE.EVENT: {
                const { window } = group
                if (!window || typeof window.start !== 'number' || typeof window.end !== 'number') {
                    return null
                }
                return now >= window.start && now <= window.end ? window.start : null
            }
            default:
                return null
        }
    }

    #groupKey(group: QuestGroupConfig, index: number): string {
        return typeof group.id === 'string' && group.id ? group.id : `${group.cadence}:${index}`
    }

    // Player anchoring only applies to the resetting cadences (daily/weekly);
    // 'permanent' and 'event' periods are inherently absolute.
    #isPlayerAnchored(group: QuestGroupConfig): boolean {
        return group.anchor === ANCHOR.PLAYER
            && (group.cadence === CADENCE.DAILY || group.cadence === CADENCE.WEEKLY)
    }

    // Picks the period's active quests from the group's eligible pool. 'random' is
    // seeded by the period (stable across reloads); 'sequential' walks the pool.
    #selectQuests(group: QuestGroupConfig, period: number, poolCursor: number): GroupState {
        const eligible = group.pool.filter((template) => this.#isEligible(template))
        if (eligible.length === 0) {
            return { periodKey: period, quests: [], poolCursor }
        }

        const requested = typeof group.count === 'number' && group.count > 0
            ? Math.floor(group.count)
            : eligible.length
        const count = Math.min(requested, eligible.length)

        let chosen: QuestTemplate[]
        let nextCursor = poolCursor

        if (group.selection === SELECTION_MODE.SEQUENTIAL) {
            chosen = Array.from({ length: count }, (_unused, i) => eligible[(poolCursor + i) % eligible.length])
            nextCursor = (poolCursor + count) % eligible.length
        } else {
            chosen = seededShuffle(eligible, this.#seedFor(group, period)).slice(0, count)
        }

        const quests = chosen.map<QuestProgress>((template) => ({
            id: template.id,
            progress: 0,
            claimed: false,
        }))
        return { periodKey: period, quests, poolCursor: nextCursor }
    }

    // A quest is eligible when every condition references a known player attribute
    // that satisfies its constraint. Missing attributes fail closed.
    #isEligible(template: QuestTemplate): boolean {
        const { conditions } = template
        if (!conditions) {
            return true
        }
        return Object.keys(conditions).every((attribute) => {
            if (!(attribute in this.#playerContext)) {
                return false
            }
            const value = this.#playerContext[attribute]
            const condition = conditions[attribute]
            if (condition.min != null && !(typeof value === 'number' && value >= condition.min)) {
                return false
            }
            if (condition.max != null && !(typeof value === 'number' && value <= condition.max)) {
                return false
            }
            if (condition.eq != null && value !== condition.eq) {
                return false
            }
            if (condition.in != null && !condition.in.includes(value)) {
                return false
            }
            return true
        })
    }

    #seedFor(group: QuestGroupConfig, period: number): number {
        return period * 8 + (CADENCE_SEED_SALT[group.cadence] ?? 0)
    }

    #findQuestEntry(
        active: { group: QuestGroupConfig, key: string }[],
        state: QuestsState,
        questId: string,
    ): { group: QuestGroupConfig, quest: QuestProgress } | null {
        let found: { group: QuestGroupConfig, quest: QuestProgress } | null = null
        active.some(({ group, key }) => {
            const quest = state.groups[key].quests.find((item) => item.id === questId)
            if (quest) {
                found = { group, quest }
                return true
            }
            return false
        })
        return found
    }

    #findTemplate(group: QuestGroupConfig, id: string): QuestTemplate | undefined {
        return group.pool.find((template) => template.id === id)
    }

    #buildQuest(group: QuestGroupConfig, quest: QuestProgress, template: QuestTemplate): Quest {
        const progress = Math.min(quest.progress, template.target)
        return {
            id: template.id,
            cadence: group.cadence,
            metric: template.metric,
            reward: template.reward,
            progress,
            target: template.target,
            completed: progress >= template.target,
            claimed: quest.claimed,
        }
    }

    #isValidGroup(group: unknown): group is QuestGroupConfig {
        if (!group || typeof group !== 'object') {
            return false
        }
        const data = group as AnyRecord
        const cadenceValues = Object.values(CADENCE) as string[]
        return typeof data.cadence === 'string'
            && cadenceValues.includes(data.cadence)
            && Array.isArray(data.pool)
    }

    async #getNow(): Promise<number> {
        let time: number
        try {
            time = await this._platformBridge.getServerTime()
        } catch {
            time = Date.now()
        }
        if (typeof time !== 'number' || !Number.isFinite(time)) {
            time = Date.now()
        }
        return time
    }

    #load(): Promise<QuestsState> {
        if (this.#state) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(QUESTS_STORAGE_KEY, true)
            .then((raw) => {
                this.#state = this.#normalizeState(raw)
                this.#loadPromise = null
                return this.#state
            })
            .catch(() => {
                this.#state = this.#defaultState()
                this.#loadPromise = null
                return this.#state
            })
        return this.#loadPromise
    }

    #persist(): Promise<void> {
        if (!this.#state) {
            return Promise.resolve()
        }
        return storageModule.set(QUESTS_STORAGE_KEY, this.#state)
    }

    #defaultState(): QuestsState {
        return { groups: {}, anchors: {} }
    }

    #normalizeState(raw: unknown): QuestsState {
        if (!raw || typeof raw !== 'object') {
            return this.#defaultState()
        }
        const data = raw as AnyRecord
        const rawGroups = data.groups
        if (!rawGroups || typeof rawGroups !== 'object') {
            return this.#defaultState()
        }
        const groups: Record<string, GroupState> = {}
        Object.keys(rawGroups as AnyRecord).forEach((key) => {
            const groupState = this.#normalizeGroupState((rawGroups as AnyRecord)[key])
            if (groupState) {
                groups[key] = groupState
            }
        })
        return { groups, anchors: this.#normalizeAnchors(data.anchors) }
    }

    #normalizeAnchors(raw: unknown): Record<string, number> {
        const anchors: Record<string, number> = {}
        if (!raw || typeof raw !== 'object') {
            return anchors
        }
        const data = raw as AnyRecord
        Object.keys(data).forEach((key) => {
            const value = data[key]
            if (typeof value === 'number' && Number.isFinite(value)) {
                anchors[key] = Math.floor(value)
            }
        })
        return anchors
    }

    #normalizeGroupState(raw: unknown): GroupState | null {
        if (!raw || typeof raw !== 'object') {
            return null
        }
        const data = raw as AnyRecord
        if (typeof data.periodKey !== 'number') {
            return null
        }
        const poolCursor = typeof data.poolCursor === 'number' && data.poolCursor >= 0
            ? Math.floor(data.poolCursor)
            : 0
        const quests = Array.isArray(data.quests)
            ? data.quests
                .map((item) => this.#normalizeQuest(item))
                .filter((item): item is QuestProgress => item !== null)
            : []
        return { periodKey: Math.floor(data.periodKey), quests, poolCursor }
    }

    #normalizeQuest(raw: unknown): QuestProgress | null {
        if (!raw || typeof raw !== 'object') {
            return null
        }
        const data = raw as AnyRecord
        if (typeof data.id !== 'string') {
            return null
        }
        const progress = typeof data.progress === 'number' && data.progress >= 0
            ? Math.floor(data.progress)
            : 0
        return { id: data.id, progress, claimed: data.claimed === true }
    }
}

export default QuestsModule
