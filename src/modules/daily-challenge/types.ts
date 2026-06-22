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
import type { SELECTION_MODE } from './constants'

export type SelectionMode = typeof SELECTION_MODE[keyof typeof SELECTION_MODE]

// A single quest definition from the config pool. The module is data-only:
// `metric` is the join key with gameplay (the game calls reportProgress(metric)),
// `target` is the amount needed, and `reward` is an opaque id the game redeems.
// Display text (title/description) is intentionally not modelled here — the game
// owns it and maps it from the metric/id.
export interface QuestTemplate {
    id: string
    metric: string
    target: number
    reward: string
}

export interface DailyChallengeConfig {
    // The set of quests to draw the day's active challenges from.
    pool: QuestTemplate[]
    // How many quests are active per day. Defaults to the whole pool size.
    questsPerDay?: number
    // 'random' (seeded by the day, stable across reloads) or 'sequential' (walk the pool).
    selection?: SelectionMode
}

// Per-quest progress for the active day, persisted through the storage module.
export interface QuestProgress {
    id: string
    progress: number
    claimed: boolean
}

export interface DailyChallengeState {
    // UTC epoch-day number the active set belongs to; a change triggers a roll-over.
    epochDay: number
    quests: QuestProgress[]
    // Walk position into the pool, only used by the 'sequential' selection mode.
    poolCursor: number
}

// What getQuests()/reportProgress() return: the template joined with live progress.
export interface DailyQuest {
    id: string
    metric: string
    reward: string
    // Current amount, clamped to target.
    progress: number
    // Needed amount.
    target: number
    completed: boolean
    claimed: boolean
}

export interface DailyChallengeBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options?: AnyRecord
    getServerTime(): Promise<number>
}
