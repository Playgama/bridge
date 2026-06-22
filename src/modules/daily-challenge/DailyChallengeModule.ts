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
    DAILY_CHALLENGE_STORAGE_KEY,
    MS_PER_DAY,
    SELECTION_MODE,
} from './constants'
import type {
    DailyChallengeState,
    DailyChallengeBridgeContract,
    DailyQuest,
    QuestProgress,
    QuestTemplate,
    SelectionMode,
} from './types'

/**
 * Daily challenge / quests module. The game developer configures a pool of quest
 * templates (id, the gameplay `metric` to watch, the `target` amount, and an opaque
 * `reward` id) through the bridge options. Each UTC day the module picks an active
 * set from the pool — either deterministically random (seeded by the day, so it is
 * stable across reloads) or sequentially — and resets progress. The game reports
 * gameplay via reportProgress(metric), the module advances every matching active
 * quest, persists progress through the storage module, and exposes claim state.
 *
 * The module is data-only: it tracks numbers, not meaning. Display text and what a
 * reward actually grants are owned by the game, keyed off the metric/reward ids.
 */
class DailyChallengeModule extends ModuleBase<DailyChallengeBridgeContract> {
    #pool: QuestTemplate[] = []

    #questsPerDay = 0

    #selection: SelectionMode = SELECTION_MODE.RANDOM

    // Optional runtime override of the config pool (escape hatch for games that
    // fetch their own quest definitions). Takes precedence over the config pool.
    #injectedPool: QuestTemplate[] | null = null

    #state: DailyChallengeState | null = null

    #loadPromise: Promise<DailyChallengeState> | null = null

    initialize(platformBridge: DailyChallengeBridgeContract): this {
        super.initialize(platformBridge)

        // SaaS hook point. To add a server-authoritative (cheat-resistant) backend
        // later, follow the LeaderboardsModule pattern: when this._isSaas(MODULE_NAME.
        // DAILY_CHALLENGE) is true, create a SaasRequest client here and branch each
        // public method to relay through it (getQuests -> GET, reportProgress/
        // claimReward -> POST). The server then owns the pool, daily selection, and
        // claim validation, so the local config pool and selection below stay dormant
        // as the no-SaaS fallback. The public API and DailyQuest shape are unchanged.

        const config = bridgeConfig.getValues().dailyChallenge
        this.#pool = Array.isArray(config?.pool) ? config!.pool : []
        this.#questsPerDay = typeof config?.questsPerDay === 'number' && config.questsPerDay > 0
            ? Math.floor(config.questsPerDay)
            : this.#pool.length
        this.#selection = config?.selection === SELECTION_MODE.SEQUENTIAL
            ? SELECTION_MODE.SEQUENTIAL
            : SELECTION_MODE.RANDOM
        return this
    }

    // Replaces the config-provided pool at runtime. Call before the first read so
    // the first daily roll-over uses it. Pass null to fall back to the config pool.
    setQuestPool(pool: QuestTemplate[] | null): void {
        this.#injectedPool = Array.isArray(pool) ? pool : null
    }

    // Today's active quests joined with the player's live progress.
    async getQuests(): Promise<DailyQuest[]> {
        const state = await this.#refresh()
        return state.quests
            .map((quest) => this.#toDailyQuest(quest))
            .filter((quest): quest is DailyQuest => quest !== null)
    }

    // Increments every active, incomplete quest watching `metric` by `amount`
    // (clamped to its target). Returns the quests that became complete on this call,
    // so the game can surface a "quest complete" prompt. No-op metrics return [].
    async reportProgress(metric: string, amount = 1): Promise<DailyQuest[]> {
        return this.#advance(metric, (quest, template) => Math.min(quest.progress + amount, template.target))
    }

    // Sets the absolute progress for every active quest watching `metric` (clamped
    // to its target) — for cumulative stats the game tracks itself. Returns the
    // quests that became complete on this call.
    async setProgress(metric: string, value: number): Promise<DailyQuest[]> {
        return this.#advance(metric, (_quest, template) => Math.min(value, template.target))
    }

    // Reward id of a completed-but-unclaimed quest, or null if not claimable.
    async getCurrentReward(questId: string): Promise<string | null> {
        const state = await this.#refresh()
        const quest = state.quests.find((item) => item.id === questId)
        if (!quest || quest.claimed) {
            return null
        }
        const template = this.#findTemplate(quest.id)
        if (!template || quest.progress < template.target) {
            return null
        }
        return template.reward
    }

    // Marks a completed quest's reward as claimed. Returns false when the quest is
    // unknown, not yet complete, or already claimed.
    async claimReward(questId: string): Promise<boolean> {
        const state = await this.#refresh()
        const quest = state.quests.find((item) => item.id === questId)
        if (!quest || quest.claimed) {
            return false
        }
        const template = this.#findTemplate(quest.id)
        if (!template || quest.progress < template.target) {
            return false
        }

        quest.claimed = true
        await this.#persist()
        return true
    }

    async #advance(
        metric: string,
        next: (quest: QuestProgress, template: QuestTemplate) => number,
    ): Promise<DailyQuest[]> {
        const state = await this.#refresh()
        const justCompleted: DailyQuest[] = []

        state.quests.forEach((quest, index) => {
            const template = this.#findTemplate(quest.id)
            if (!template || template.metric !== metric) {
                return
            }

            const wasCompleted = quest.progress >= template.target
            const updated = state.quests[index]
            updated.progress = Math.max(0, next(quest, template))

            if (!wasCompleted && updated.progress >= template.target) {
                justCompleted.push(this.#buildDailyQuest(updated, template))
            }
        })

        if (justCompleted.length > 0) {
            await this.#persist()
        }
        return justCompleted
    }

    // Loads state, then rolls over to a fresh active set when the stored day differs
    // from today. Selection is the only place the pool is consulted for membership.
    async #refresh(): Promise<DailyChallengeState> {
        const state = await this.#load()
        const todayEpochDay = await this.#getTodayEpochDay()
        if (state.epochDay !== todayEpochDay) {
            const { quests, poolCursor } = this.#selectQuests(todayEpochDay, state.poolCursor)
            state.epochDay = todayEpochDay
            state.quests = quests
            state.poolCursor = poolCursor
            await this.#persist()
        }
        return state
    }

    // Picks the day's active quests from the active pool. 'random' is seeded by the
    // epoch-day so the same day yields the same set across reloads (and across
    // players, since the seed is shared). 'sequential' walks the pool via the cursor.
    #selectQuests(epochDay: number, poolCursor: number): { quests: QuestProgress[], poolCursor: number } {
        const pool = this.#activePool()
        if (pool.length === 0) {
            return { quests: [], poolCursor }
        }

        const count = Math.min(this.#questsPerDay || pool.length, pool.length)
        let chosen: QuestTemplate[]
        let nextCursor = poolCursor

        if (this.#selection === SELECTION_MODE.SEQUENTIAL) {
            chosen = Array.from({ length: count }, (_unused, i) => pool[(poolCursor + i) % pool.length])
            nextCursor = (poolCursor + count) % pool.length
        } else {
            chosen = seededShuffle(pool, epochDay).slice(0, count)
        }

        const quests = chosen.map<QuestProgress>((template) => ({
            id: template.id,
            progress: 0,
            claimed: false,
        }))
        return { quests, poolCursor: nextCursor }
    }

    #activePool(): QuestTemplate[] {
        return this.#injectedPool ?? this.#pool
    }

    #findTemplate(id: string): QuestTemplate | undefined {
        return this.#activePool().find((template) => template.id === id)
    }

    // Joins stored progress with its template; returns null if the template no longer
    // exists in the pool (e.g. the remote pool changed mid-cycle).
    #toDailyQuest(quest: QuestProgress): DailyQuest | null {
        const template = this.#findTemplate(quest.id)
        return template ? this.#buildDailyQuest(quest, template) : null
    }

    #buildDailyQuest(quest: QuestProgress, template: QuestTemplate): DailyQuest {
        const progress = Math.min(quest.progress, template.target)
        return {
            id: template.id,
            metric: template.metric,
            reward: template.reward,
            progress,
            target: template.target,
            completed: progress >= template.target,
            claimed: quest.claimed,
        }
    }

    async #getTodayEpochDay(): Promise<number> {
        let time: number
        try {
            time = await this._platformBridge.getServerTime()
        } catch {
            time = Date.now()
        }
        if (typeof time !== 'number' || !Number.isFinite(time)) {
            time = Date.now()
        }
        return Math.floor(time / MS_PER_DAY)
    }

    #load(): Promise<DailyChallengeState> {
        if (this.#state) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(DAILY_CHALLENGE_STORAGE_KEY, true)
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
        return storageModule.set(DAILY_CHALLENGE_STORAGE_KEY, this.#state)
    }

    #defaultState(): DailyChallengeState {
        // epochDay -1 guarantees the first #refresh() triggers a roll-over.
        return { epochDay: -1, quests: [], poolCursor: 0 }
    }

    #normalizeState(raw: unknown): DailyChallengeState {
        if (!raw || typeof raw !== 'object') {
            return this.#defaultState()
        }
        const data = raw as AnyRecord
        const epochDay = typeof data.epochDay === 'number' ? Math.floor(data.epochDay) : -1
        const poolCursor = typeof data.poolCursor === 'number' && data.poolCursor >= 0
            ? Math.floor(data.poolCursor)
            : 0
        const quests = Array.isArray(data.quests)
            ? data.quests
                .map((item) => this.#normalizeQuest(item))
                .filter((item): item is QuestProgress => item !== null)
            : []
        return { epochDay, quests, poolCursor }
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

export default DailyChallengeModule
