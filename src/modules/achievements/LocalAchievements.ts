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
    AchievementsBridgeContract,
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

    #platformBridge: AchievementsBridgeContract

    #state: LocalAchievementsState | null = null

    // Whose data #state was loaded from; the state is reloaded when it changes.
    #stateOwner: string | null = null

    #loadPromise: Promise<LocalAchievementsState> | null = null

    constructor(achievements: AchievementMapping[], platformBridge: AchievementsBridgeContract) {
        this.#achievements = achievements
        this.#platformBridge = platformBridge
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
        const owner = this.#getStateOwner()
        if (this.#state && this.#stateOwner === owner) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(ACHIEVEMENTS_STORAGE_KEY, true)
            .then((raw) => {
                this.#state = this.#normalizeState(raw)
                this.#stateOwner = owner
                this.#loadPromise = null
                return this.#state
            })
            .catch((error) => {
                // No default state on a failed read: saving it would overwrite the stored data.
                // The call rejects and the next one reads again.
                this.#loadPromise = null
                throw error
            })
        return this.#loadPromise
    }

    #persist(): Promise<void> {
        // Never save a state loaded for another player (e.g. a guest who has since authorized).
        if (!this.#state || this.#stateOwner !== this.#getStateOwner()) {
            return Promise.resolve()
        }
        return storageModule.set(ACHIEVEMENTS_STORAGE_KEY, this.#state)
    }

    // Whose data the storage serves: the current player's cloud or local storage.
    #getStateOwner(): string {
        const { isPlatformStorageAvailable, playerId } = this.#platformBridge
        return isPlatformStorageAvailable ? `cloud:${playerId ?? ''}` : 'local'
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
