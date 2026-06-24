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
import type { CADENCE, SELECTION_MODE, ANCHOR } from './constants'

export type Cadence = typeof CADENCE[keyof typeof CADENCE]

export type SelectionMode = typeof SELECTION_MODE[keyof typeof SELECTION_MODE]

export type Anchor = typeof ANCHOR[keyof typeof ANCHOR]

// Attribute values the game knows about the player. Supplied via setPlayerContext()
// and matched against quest conditions to decide eligibility (Pattern A segmentation).
export type PlayerContext = Record<string, number | string | boolean>

// A single eligibility constraint on one player attribute. All provided checks
// must pass. `min`/`max` apply to numbers; `eq`/`in` to any value.
export interface QuestCondition {
    min?: number
    max?: number
    eq?: number | string | boolean
    in?: (number | string | boolean)[]
}

// Conditions keyed by player-attribute name (e.g. { level: { min: 10 } }). A quest
// is eligible only if every referenced attribute is present in the context AND
// satisfies its constraint (fail-closed on missing attributes).
export type QuestConditions = Record<string, QuestCondition>

// A single quest definition from a group's pool. Data-only: `metric` is the join
// key with gameplay, `target` the amount needed, `reward` an opaque id the game
// redeems. Display text is owned by the game. Ids must be unique across all groups.
export interface QuestTemplate {
    id: string
    metric: string
    target: number
    reward: string
    conditions?: QuestConditions
}

// The active window for an 'event' cadence group, as epoch-ms bounds (inclusive).
export interface EventWindow {
    start: number
    end: number
}

// A group of quests sharing a cadence and selection policy.
export interface QuestGroupConfig {
    cadence: Cadence
    // Optional stable key; defaults to `${cadence}:${index}`. Set it when you have
    // multiple groups of the same cadence so their stored state stays distinct.
    id?: string
    // How many quests are active per period. Defaults to all eligible quests.
    count?: number
    selection?: SelectionMode
    // Daily/weekly period anchoring; defaults to 'calendar'. 'player' makes the
    // period roll over relative to the player's first play. Ignored for
    // 'permanent' and 'event' cadences.
    anchor?: Anchor
    // Required for the 'event' cadence; ignored otherwise.
    window?: EventWindow
    pool: QuestTemplate[]
}

export interface QuestsConfig {
    groups: QuestGroupConfig[]
}

// Per-quest progress for the active period, persisted through the storage module.
export interface QuestProgress {
    id: string
    progress: number
    claimed: boolean
}

// Persisted state for one group: the period its quests belong to (a roll-over
// trigger), the chosen quests, and the sequential-selection cursor.
export interface GroupState {
    periodKey: number
    quests: QuestProgress[]
    poolCursor: number
}

export interface QuestsState {
    // Keyed by group key (QuestGroupConfig.id ?? `${cadence}:${index}`).
    groups: Record<string, GroupState>
    // First-play timestamp (epoch ms) per player-anchored group key, captured once.
    anchors: Record<string, number>
}

// What getQuests()/reportProgress() return: a template joined with live progress
// and tagged with its cadence so the game can group quests in the UI.
export interface Quest {
    id: string
    cadence: Cadence
    metric: string
    reward: string
    // Current amount, clamped to target.
    progress: number
    // Needed amount.
    target: number
    completed: boolean
    claimed: boolean
}

export interface QuestsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options?: AnyRecord
    getServerTime(): Promise<number>
}
