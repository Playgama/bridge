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
import type { AnyRecord } from '../../utils'
import bridgeConfig from '../../lib/bridge-config'
import storageModule from '../storage'
import {
    QUESTS_STORAGE_KEY,
    MS_PER_DAY,
    MS_PER_WEEK,
    QUEST_TYPE,
    PERMANENT_PERIOD,
} from './constants'
import type {
    QuestsState,
    GroupState,
    QuestsBridgeContract,
    Quest,
    QuestReward,
    QuestProgress,
    TargetProgress,
    QuestItemConfig,
    QuestGroupConfig,
} from './types'

/**
 * Quests module. The game configures one or more quest groups, each with a
 * type — 'daily' / 'weekly' (reset every UTC day/week) or 'permanent'
 * (never resets). Every quest in a group's `items` is active for the period.
 * A quest has one or more `targets` (each a gameplay metric + amount) and
 * completes when ALL of its targets are met; it then grants its `rewards`.
 *
 * The game reports gameplay via addProgress(metric); the module advances every
 * matching target across all active quests/types, persists through the storage
 * module, and exposes claim state.
 *
 * The module is data-only: it tracks numbers, not meaning. Display text, player
 * segmentation, and what a reward grants are owned by the game, keyed off the
 * target/reward ids. getQuests() always returns the full active list.
 */
class QuestsModule extends ModuleBase<QuestsBridgeContract> {
    #groups: QuestGroupConfig[] = []

    #state: QuestsState | null = null

    #loadPromise: Promise<QuestsState> | null = null

    initialize(platformBridge: QuestsBridgeContract): this {
        super.initialize(platformBridge)

        // SaaS hook point. To add a server-authoritative (cheat-resistant) backend
        // later, follow the LeaderboardsModule pattern: when this._isSaas(MODULE_NAME.
        // QUESTS) is true, create a SaasRequest client here and branch each public
        // method to relay through it (getQuests -> GET, addProgress/claimReward
        // -> POST). The server then owns progress and claim validation, so the local
        // config below stays dormant as the no-SaaS fallback. The public API and
        // Quest shape are unchanged.

        const config = bridgeConfig.getValues().quests
        this.#groups = Array.isArray(config)
            ? config.filter((group) => this.#isValidGroup(group))
            : []
        return this
    }

    // Every active quest across all groups, joined with live progress.
    async getQuests(): Promise<Quest[]> {
        const { state, active } = await this.#sync()
        const result: Quest[] = []
        active.forEach(({ group, key }) => {
            state.groups[key].quests.forEach((quest) => {
                const item = this.#findItem(group, quest.id)
                if (item) {
                    result.push(this.#buildQuest(group, quest, item))
                }
            })
        })
        return result
    }

    // Increments every active target watching `metric` by `amount` (clamped to its
    // target amount), across all types. Returns the quests that became fully
    // complete on this call. No-op metrics return [].
    async addProgress(metric: string, amount = 1): Promise<Quest[]> {
        const { state, active } = await this.#sync()
        const justCompleted: Quest[] = []
        let changed = false

        active.forEach(({ group, key }) => {
            state.groups[key].quests.forEach((quest) => {
                const item = this.#findItem(group, quest.id)
                if (!item) {
                    return
                }

                const wasCompleted = this.#isQuestComplete(item, quest)
                let touched = false

                item.targets.forEach((targetConfig) => {
                    if (targetConfig.id !== metric) {
                        return
                    }
                    const target = this.#ensureTarget(quest, targetConfig.id)
                    const previous = target.progress
                    target.progress = Math.min(Math.max(0, previous + amount), targetConfig.amount)
                    if (target.progress !== previous) {
                        changed = true
                        touched = true
                    }
                })

                if (touched && !wasCompleted && this.#isQuestComplete(item, quest)) {
                    justCompleted.push(this.#buildQuest(group, quest, item))
                }
            })
        })

        if (changed) {
            await this.#persist()
        }
        return justCompleted
    }

    // Marks a completed quest's rewards as claimed and returns them for the game to
    // grant. Returns null when the quest is not currently active, not complete, or
    // already claimed.
    async claimReward(questId: string): Promise<QuestReward[] | null> {
        const { state, active } = await this.#sync()
        const found = this.#findQuestEntry(active, state, questId)
        if (!found || found.quest.claimed) {
            return null
        }
        const item = this.#findItem(found.group, found.quest.id)
        if (!item || !this.#isQuestComplete(item, found.quest)) {
            return null
        }

        found.quest.claimed = true
        await this.#persist()
        return item.rewards.map((reward) => ({ id: reward.id, amount: reward.amount }))
    }

    // Loads state, then for every group rolls over to fresh, zeroed quests when its
    // period changed. Returns the state and the active groups so callers only ever
    // touch live quests.
    async #sync(): Promise<{ state: QuestsState, active: { group: QuestGroupConfig, key: string }[] }> {
        const state = await this.#load()
        const now = await this.#getNow()
        const active: { group: QuestGroupConfig, key: string }[] = []
        let dirty = false

        this.#groups.forEach((group) => {
            const key = group.id
            const period = this.#periodKey(group, now)
            const current = state.groups[key]
            if (!current || current.periodKey !== period) {
                state.groups[key] = { periodKey: period, quests: this.#buildInitialQuests(group) }
                dirty = true
            }
            active.push({ group, key })
        })

        if (dirty) {
            await this.#persist()
        }
        return { state, active }
    }

    #periodKey(group: QuestGroupConfig, now: number): number {
        switch (group.type) {
            case QUEST_TYPE.DAILY:
                return Math.floor(now / MS_PER_DAY)
            case QUEST_TYPE.WEEKLY:
                return Math.floor(now / MS_PER_WEEK)
            default:
                return PERMANENT_PERIOD
        }
    }

    #buildInitialQuests(group: QuestGroupConfig): QuestProgress[] {
        return group.items.map((item) => ({
            id: item.id,
            targets: item.targets.map((target) => ({ id: target.id, progress: 0 })),
            claimed: false,
        }))
    }

    #ensureTarget(quest: QuestProgress, targetId: string): TargetProgress {
        let target = quest.targets.find((item) => item.id === targetId)
        if (!target) {
            target = { id: targetId, progress: 0 }
            quest.targets.push(target)
        }
        return target
    }

    // A quest is complete when every configured target has reached its amount.
    #isQuestComplete(item: QuestItemConfig, quest: QuestProgress): boolean {
        return item.targets.every((targetConfig) => {
            const target = quest.targets.find((entry) => entry.id === targetConfig.id)
            return target != null && target.progress >= targetConfig.amount
        })
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

    #findItem(group: QuestGroupConfig, id: string): QuestItemConfig | undefined {
        return group.items.find((item) => item.id === id)
    }

    #buildQuest(group: QuestGroupConfig, quest: QuestProgress, item: QuestItemConfig): Quest {
        const targets = item.targets.map((targetConfig) => {
            const stored = quest.targets.find((entry) => entry.id === targetConfig.id)
            const progress = Math.min(stored ? stored.progress : 0, targetConfig.amount)
            return {
                id: targetConfig.id,
                amount: targetConfig.amount,
                progress,
                completed: progress >= targetConfig.amount,
            }
        })
        return {
            id: item.id,
            type: group.type,
            targets,
            rewards: item.rewards.map((reward) => ({ id: reward.id, amount: reward.amount })),
            completed: targets.every((target) => target.completed),
            claimed: quest.claimed,
        }
    }

    #isValidGroup(group: unknown): group is QuestGroupConfig {
        if (!group || typeof group !== 'object') {
            return false
        }
        const data = group as AnyRecord
        const typeValues = Object.values(QUEST_TYPE) as string[]
        return typeof data.id === 'string'
            && typeof data.type === 'string'
            && typeValues.includes(data.type)
            && Array.isArray(data.items)
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
        return { groups: {} }
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
        return { groups }
    }

    #normalizeGroupState(raw: unknown): GroupState | null {
        if (!raw || typeof raw !== 'object') {
            return null
        }
        const data = raw as AnyRecord
        if (typeof data.periodKey !== 'number') {
            return null
        }
        const quests = Array.isArray(data.quests)
            ? data.quests
                .map((item) => this.#normalizeQuest(item))
                .filter((item): item is QuestProgress => item !== null)
            : []
        return { periodKey: Math.floor(data.periodKey), quests }
    }

    #normalizeQuest(raw: unknown): QuestProgress | null {
        if (!raw || typeof raw !== 'object') {
            return null
        }
        const data = raw as AnyRecord
        if (typeof data.id !== 'string') {
            return null
        }
        const targets = Array.isArray(data.targets)
            ? data.targets
                .map((item) => this.#normalizeTarget(item))
                .filter((item): item is TargetProgress => item !== null)
            : []
        return { id: data.id, targets, claimed: data.claimed === true }
    }

    #normalizeTarget(raw: unknown): TargetProgress | null {
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
        return { id: data.id, progress }
    }
}

export default QuestsModule
