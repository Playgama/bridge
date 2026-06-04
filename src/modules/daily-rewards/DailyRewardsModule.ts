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
import storageModule from '../storage'
import { DAILY_REWARDS_STORAGE_KEY, MS_PER_DAY } from './constants'
import type {
    DailyRewardsConfig,
    DailyRewardsState,
    DailyRewardsBridgeContract,
} from './types'

/**
 * Daily rewards module. The game developer configures the ordered list of reward
 * ids (one per day) through the bridge options. The module tracks the current day
 * using the platform server time (converted to a UTC epoch-day number, with a local
 * Date.now() fallback), persists progress through the storage module, and resets the
 * streak back to the first day when one or more days are missed.
 */
class DailyRewardsModule extends ModuleBase<DailyRewardsBridgeContract> {
    #rewards: string[] = []

    #cycle = true

    #resetOnMiss = true

    #state: DailyRewardsState | null = null

    #loadPromise: Promise<DailyRewardsState> | null = null

    initialize(platformBridge: DailyRewardsBridgeContract): this {
        super.initialize(platformBridge)

        const config = platformBridge.options?.dailyRewards as DailyRewardsConfig | undefined
        this.#rewards = Array.isArray(config?.rewards) ? config!.rewards : []
        this.#cycle = typeof config?.cycle === 'boolean' ? config.cycle : true
        this.#resetOnMiss = typeof config?.resetOnMiss === 'boolean' ? config.resetOnMiss : true
        return this
    }

    // Configured list of reward ids.
    async getRewards(): Promise<string[]> {
        return [...this.#rewards]
    }

    // 0-based index (into the rewards list) of the reward the player is currently on.
    async getCurrentDay(): Promise<number> {
        const state = await this.#refresh()
        return state.day
    }

    // Id of the reward claimable today, or null when nothing can be claimed.
    async getCurrentReward(): Promise<string | null> {
        const state = await this.#refresh()
        if (!(await this.#canClaim(state))) {
            return null
        }
        return this.#rewards[state.day]
    }

    async claimCurrentReward(): Promise<boolean> {
        const state = await this.#refresh()
        if (!(await this.#canClaim(state))) {
            return false
        }

        state.lastClaimEpochDay = await this.#getTodayEpochDay()
        state.day = this.#cycle ? (state.day + 1) % this.#rewards.length : state.day + 1

        await this.#persist()
        return true
    }

    async #refresh(): Promise<DailyRewardsState> {
        const state = await this.#load()
        if (this.#resetOnMiss && state.lastClaimEpochDay !== null && state.day > 0) {
            const todayEpochDay = await this.#getTodayEpochDay()
            if (todayEpochDay - state.lastClaimEpochDay >= 2) {
                state.day = 0
                await this.#persist()
            }
        }
        return state
    }

    async #canClaim(state: DailyRewardsState): Promise<boolean> {
        if (state.day >= this.#rewards.length) {
            return false
        }
        if (state.lastClaimEpochDay === null) {
            return true
        }
        const todayEpochDay = await this.#getTodayEpochDay()
        return todayEpochDay > state.lastClaimEpochDay
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

    #load(): Promise<DailyRewardsState> {
        if (this.#state) {
            return Promise.resolve(this.#state)
        }
        if (this.#loadPromise) {
            return this.#loadPromise
        }
        this.#loadPromise = storageModule.get(DAILY_REWARDS_STORAGE_KEY, true)
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
        return storageModule.set(DAILY_REWARDS_STORAGE_KEY, this.#state)
    }

    #defaultState(): DailyRewardsState {
        return { day: 0, lastClaimEpochDay: null }
    }

    #normalizeState(raw: unknown): DailyRewardsState {
        if (!raw || typeof raw !== 'object') {
            return this.#defaultState()
        }
        const data = raw as AnyRecord
        const day = typeof data.day === 'number' && data.day >= 0 ? Math.floor(data.day) : 0
        const lastClaimEpochDay = typeof data.lastClaimEpochDay === 'number'
            ? Math.floor(data.lastClaimEpochDay)
            : null
        return { day, lastClaimEpochDay }
    }
}

export default DailyRewardsModule
