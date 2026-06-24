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

import type { AnyRecord } from '../../utils'
import storageModule from '../storage'
import { ACHIEVEMENTS_STORAGE_KEY } from './constants'
import type {
    AchievementMapping,
    LocalAchievementsState,
    NormalizedAchievement,
} from './types'

/**
 * SDK-managed achievements used on platforms without native achievements support.
 * The game developer configures the achievements list (id plus optional name and
 * description) through the bridge options; this store tracks which ids the player
 * has unlocked and persists them through the storage module (which transparently
 * uses the platform cloud when available, otherwise local storage).
 */
class LocalAchievements {
    #achievements: AchievementMapping[]

    #state: LocalAchievementsState | null = null

    #loadPromise: Promise<LocalAchievementsState> | null = null

    constructor(achievements: AchievementMapping[]) {
        this.#achievements = achievements
    }

    async unlock(id: string): Promise<void> {
        if (!id) {
            return
        }

        const state = await this.#load()
        if (!state.unlocked.includes(id)) {
            state.unlocked.push(id)
            await this.#persist()
        }
    }

    // Configured achievements list with the locally tracked unlocked state.
    async getList(): Promise<NormalizedAchievement[]> {
        const state = await this.#load()
        return this.#achievements.map((achievement) => ({
            id: achievement.id,
            name: typeof achievement.name === 'string' ? achievement.name : undefined,
            description: typeof achievement.description === 'string' ? achievement.description : undefined,
            unlocked: state.unlocked.includes(achievement.id),
        }))
    }

    #load(): Promise<LocalAchievementsState> {
        if (this.#state) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(ACHIEVEMENTS_STORAGE_KEY, true)
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
        return storageModule.set(ACHIEVEMENTS_STORAGE_KEY, this.#state)
    }

    #defaultState(): LocalAchievementsState {
        return { unlocked: [] }
    }

    #normalizeState(raw: unknown): LocalAchievementsState {
        if (!raw || typeof raw !== 'object') {
            return this.#defaultState()
        }
        const data = raw as AnyRecord
        const unlocked = Array.isArray(data.unlocked)
            ? data.unlocked.filter((id): id is string => typeof id === 'string')
            : []
        return { unlocked }
    }
}

export default LocalAchievements
