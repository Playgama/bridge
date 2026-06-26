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
import type { AdvertisementOptions } from '../../modules/advertisement/types'
import type { DailyRewardsConfig } from '../../modules/daily-rewards/types'
import type { TasksConfig } from '../../modules/tasks/types'
import type { CrossPromoConfig } from '../../modules/cross-promo/types'
import type { LeaderboardMapping } from '../../modules/leaderboards'
import type { DeviceConfig } from '../../modules/device'

export interface SaasFeatureConfig {
    platforms?: string[]
}

export interface SaasConfig {
    baseUrl?: string
    publicToken?: string
    // Per-feature SaaS configuration keyed by feature name.
    [feature: string]: SaasFeatureConfig | string | undefined
}

export interface GameConfig {
    adaptToSafeArea?: boolean
    [key: string]: unknown
}

// Single source of truth for the whole bridge configuration. Every config
// section is typed here so consumers read it through the config loader without
// per-site casts. The string index signature keeps platform-specific keys
// (devId, gameId, adSenseId, ...) accessible to the platform bridges.
export interface ConfigFileOptions extends AnyRecord {
    platforms?: Record<string, ConfigFileOptions>
    debug?: boolean
    forciblySetPlatformId?: string
    remoteConfigUrl?: string
    remoteConfigTimeout?: number
    remoteConfigTtl?: number
    sendAnalyticsEvents?: boolean
    disableLoadingLogo?: boolean
    showFullLoadingLogo?: boolean
    showLoadingText?: boolean
    game?: GameConfig
    advertisement?: AdvertisementOptions
    dailyRewards?: DailyRewardsConfig
    tasks?: TasksConfig
    leaderboards?: LeaderboardMapping[]
    device?: DeviceConfig
    crossPromo?: CrossPromoConfig
    saas?: SaasConfig
    payments?: Array<AnyRecord & { id: string }>
}
