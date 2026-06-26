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
    TASKS_STORAGE_KEY,
    MS_PER_DAY,
    MS_PER_WEEK,
    TASK_TYPE,
    PERMANENT_PERIOD,
} from './constants'
import type {
    TasksState,
    GroupState,
    TasksBridgeContract,
    Task,
    TaskReward,
    TaskProgress,
    TargetProgress,
    TaskItemConfig,
    TaskGroupConfig,
} from './types'

/**
 * Tasks module. The game configures one or more task groups, each with a
 * type — 'daily' / 'weekly' (reset every UTC day/week) or 'permanent'
 * (never resets). Every task in a group's `items` is active for the period.
 * A task has one or more `targets` (each a gameplay metric + amount) and
 * completes when ALL of its targets are met; it then grants its `rewards`.
 *
 * The game reports gameplay via addProgress(metric); the module advances every
 * matching target across all active tasks/types, persists through the storage
 * module, and exposes claim state.
 *
 * The module is data-only: it tracks numbers, not meaning. Display text, player
 * segmentation, and what a reward grants are owned by the game, keyed off the
 * target/reward ids. getTasks() always returns the full active list.
 */
class TasksModule extends ModuleBase<TasksBridgeContract> {
    #groups: TaskGroupConfig[] = []

    #state: TasksState | null = null

    #loadPromise: Promise<TasksState> | null = null

    initialize(platformBridge: TasksBridgeContract): this {
        super.initialize(platformBridge)

        // SaaS hook point. To add a server-authoritative (cheat-resistant) backend
        // later, follow the LeaderboardsModule pattern: when this._isSaas(MODULE_NAME.
        // TASKS) is true, create a SaasRequest client here and branch each public
        // method to relay through it (getTasks -> GET, addProgress/claimReward
        // -> POST). The server then owns progress and claim validation, so the local
        // config below stays dormant as the no-SaaS fallback. The public API and
        // Task shape are unchanged.

        const config = bridgeConfig.getValues().tasks
        this.#groups = Array.isArray(config)
            ? config.filter((group) => this.#isValidGroup(group))
            : []
        return this
    }

    // Every active task across all groups, joined with live progress.
    async getTasks(): Promise<Task[]> {
        const { state, active } = await this.#sync()
        const result: Task[] = []
        active.forEach(({ group, key }) => {
            state.groups[key].tasks.forEach((task) => {
                const item = this.#findItem(group, task.id)
                if (item) {
                    result.push(this.#buildTask(group, task, item))
                }
            })
        })
        return result
    }

    // Increments every active target watching `metric` by `amount` (clamped to its
    // target amount), across all types. Returns the tasks that became fully
    // complete on this call. No-op metrics return [].
    async addProgress(metric: string, amount = 1): Promise<Task[]> {
        const { state, active } = await this.#sync()
        const justCompleted: Task[] = []
        let changed = false

        active.forEach(({ group, key }) => {
            state.groups[key].tasks.forEach((task) => {
                const item = this.#findItem(group, task.id)
                if (!item) {
                    return
                }

                const wasCompleted = this.#isTaskComplete(item, task)
                let touched = false

                item.targets.forEach((targetConfig) => {
                    if (targetConfig.id !== metric) {
                        return
                    }
                    const target = this.#ensureTarget(task, targetConfig.id)
                    const previous = target.progress
                    target.progress = Math.min(Math.max(0, previous + amount), targetConfig.amount)
                    if (target.progress !== previous) {
                        changed = true
                        touched = true
                    }
                })

                if (touched && !wasCompleted && this.#isTaskComplete(item, task)) {
                    justCompleted.push(this.#buildTask(group, task, item))
                }
            })
        })

        if (changed) {
            await this.#persist()
        }
        return justCompleted
    }

    // Marks a completed task's rewards as claimed and returns them for the game to
    // grant. Returns null when the task is not currently active, not complete, or
    // already claimed.
    async claimReward(taskId: string): Promise<TaskReward[] | null> {
        const { state, active } = await this.#sync()
        const found = this.#findTaskEntry(active, state, taskId)
        if (!found || found.task.claimed) {
            return null
        }
        const item = this.#findItem(found.group, found.task.id)
        if (!item || !this.#isTaskComplete(item, found.task)) {
            return null
        }

        found.task.claimed = true
        await this.#persist()
        return item.rewards.map((reward) => ({ id: reward.id, amount: reward.amount }))
    }

    // Loads state, then for every group rolls over to fresh, zeroed tasks when its
    // period changed. Returns the state and the active groups so callers only ever
    // touch live tasks.
    async #sync(): Promise<{ state: TasksState, active: { group: TaskGroupConfig, key: string }[] }> {
        const state = await this.#load()
        const now = await this.#getNow()
        const active: { group: TaskGroupConfig, key: string }[] = []
        let dirty = false

        this.#groups.forEach((group) => {
            const key = group.id
            const period = this.#periodKey(group, now)
            const current = state.groups[key]
            if (!current || current.periodKey !== period) {
                state.groups[key] = { periodKey: period, tasks: this.#buildInitialTasks(group) }
                dirty = true
            }
            active.push({ group, key })
        })

        if (dirty) {
            await this.#persist()
        }
        return { state, active }
    }

    #periodKey(group: TaskGroupConfig, now: number): number {
        switch (group.type) {
            case TASK_TYPE.DAILY:
                return Math.floor(now / MS_PER_DAY)
            case TASK_TYPE.WEEKLY:
                return Math.floor(now / MS_PER_WEEK)
            default:
                return PERMANENT_PERIOD
        }
    }

    #buildInitialTasks(group: TaskGroupConfig): TaskProgress[] {
        return group.items.map((item) => ({
            id: item.id,
            targets: item.targets.map((target) => ({ id: target.id, progress: 0 })),
            claimed: false,
        }))
    }

    #ensureTarget(task: TaskProgress, targetId: string): TargetProgress {
        let target = task.targets.find((item) => item.id === targetId)
        if (!target) {
            target = { id: targetId, progress: 0 }
            task.targets.push(target)
        }
        return target
    }

    // A task is complete when every configured target has reached its amount.
    #isTaskComplete(item: TaskItemConfig, task: TaskProgress): boolean {
        return item.targets.every((targetConfig) => {
            const target = task.targets.find((entry) => entry.id === targetConfig.id)
            return target != null && target.progress >= targetConfig.amount
        })
    }

    #findTaskEntry(
        active: { group: TaskGroupConfig, key: string }[],
        state: TasksState,
        taskId: string,
    ): { group: TaskGroupConfig, task: TaskProgress } | null {
        let found: { group: TaskGroupConfig, task: TaskProgress } | null = null
        active.some(({ group, key }) => {
            const task = state.groups[key].tasks.find((item) => item.id === taskId)
            if (task) {
                found = { group, task }
                return true
            }
            return false
        })
        return found
    }

    #findItem(group: TaskGroupConfig, id: string): TaskItemConfig | undefined {
        return group.items.find((item) => item.id === id)
    }

    #buildTask(group: TaskGroupConfig, task: TaskProgress, item: TaskItemConfig): Task {
        const targets = item.targets.map((targetConfig) => {
            const stored = task.targets.find((entry) => entry.id === targetConfig.id)
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
            claimed: task.claimed,
        }
    }

    #isValidGroup(group: unknown): group is TaskGroupConfig {
        if (!group || typeof group !== 'object') {
            return false
        }
        const data = group as AnyRecord
        const typeValues = Object.values(TASK_TYPE) as string[]
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

    #load(): Promise<TasksState> {
        if (this.#state) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(TASKS_STORAGE_KEY, true)
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
        return storageModule.set(TASKS_STORAGE_KEY, this.#state)
    }

    #defaultState(): TasksState {
        return { groups: {} }
    }

    #normalizeState(raw: unknown): TasksState {
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
        const tasks = Array.isArray(data.tasks)
            ? data.tasks
                .map((item) => this.#normalizeTask(item))
                .filter((item): item is TaskProgress => item !== null)
            : []
        return { periodKey: Math.floor(data.periodKey), tasks }
    }

    #normalizeTask(raw: unknown): TaskProgress | null {
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

export default TasksModule
