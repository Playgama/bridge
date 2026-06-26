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

import type { PlatformBridgeLike } from '../ModuleBase'
import type { PlatformId } from '../platform/constants'
import type { AnyRecord } from '../../utils'
import type { QUEST_TYPE } from './constants'

export type QuestType = typeof QUEST_TYPE[keyof typeof QUEST_TYPE]

// One objective of a quest. `id` is the gameplay metric the game reports via
// addProgress(); `amount` is the value that completes this target.
export interface QuestTargetConfig {
    id: string
    amount: number
}

// One reward granted when a quest completes. Data-only: `id`/`amount` are opaque
// to the module — the game decides what they mean and grants them.
export interface QuestRewardConfig {
    id: string
    amount: number
}

// A single quest definition. Completes when ALL of its targets reach their amount.
export interface QuestItemConfig {
    id: string
    targets: QuestTargetConfig[]
    rewards: QuestRewardConfig[]
}

// A group of quests sharing a type. Every item is active for the period (no
// selection). `id` is the stable storage key.
export interface QuestGroupConfig {
    id: string
    type: QuestType
    items: QuestItemConfig[]
}

// The whole quests config: a list of groups.
export type QuestsConfig = QuestGroupConfig[]

// Persisted progress for one target.
export interface TargetProgress {
    id: string
    progress: number
}

// Persisted progress for one quest within the active period.
export interface QuestProgress {
    id: string
    targets: TargetProgress[]
    claimed: boolean
}

// Persisted state for one group: the period its progress belongs to (a roll-over
// trigger) and the per-quest progress.
export interface GroupState {
    periodKey: number
    quests: QuestProgress[]
}

export interface QuestsState {
    // Keyed by group id.
    groups: Record<string, GroupState>
}

// A target as returned to the game: its goal, current (clamped) progress, and
// whether it is met.
export interface QuestTarget {
    id: string
    amount: number
    progress: number
    completed: boolean
}

export interface QuestReward {
    id: string
    amount: number
}

// What getQuests()/addProgress() return: a quest joined with live progress,
// tagged with its group type. `completed` is true once every target is met.
export interface Quest {
    id: string
    type: QuestType
    targets: QuestTarget[]
    rewards: QuestReward[]
    completed: boolean
    claimed: boolean
}

export interface QuestsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options?: AnyRecord
    getServerTime(): Promise<number>
}
