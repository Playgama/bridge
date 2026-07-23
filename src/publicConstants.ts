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

// Side-effect-free public entry (`@playgama/bridge/constants`). Games that get
// the SDK runtime from a <script> tag import constant values and data types
// from here without pulling the whole SDK into their bundle.
//
// Every constant is exported together with a same-named type alias
// (`BANNER_STATE` is both the value map and the union of its values), so it
// can be used enum-style in both value and type positions.

/* eslint-disable @typescript-eslint/no-redeclare, prefer-destructuring --
 * each constant is deliberately declared twice — as a value and as a
 * same-named type alias (enum-style usage in both positions), and namespace
 * access keeps every value/type pair traceable to its source module. */

import './global'
import * as moduleNames from './constants/moduleName'
import * as eventNames from './constants/eventName'
import * as launchSources from './constants/launchSource'
import * as errors from './constants/errors'
import * as platformConstants from './modules/platform/constants'
import * as deviceConstants from './modules/device/constants'
import * as advertisementConstants from './modules/advertisement/constants'
import * as leaderboardsConstants from './modules/leaderboards/constants'
import * as tasksConstants from './modules/tasks/constants'
import type * as tasksTypes from './modules/tasks/types'
import * as crossPromoConstants from './modules/cross-promo/constants'

export const PLATFORM_ID = platformConstants.PLATFORM_ID
export type PLATFORM_ID = platformConstants.PlatformId

export const PLATFORM_MESSAGE = platformConstants.PLATFORM_MESSAGE
export type PLATFORM_MESSAGE = platformConstants.PlatformMessage

export const VISIBILITY_STATE = platformConstants.VISIBILITY_STATE
export type VISIBILITY_STATE = platformConstants.VisibilityState

export const MODULE_NAME = moduleNames.MODULE_NAME
export type MODULE_NAME = moduleNames.ModuleName

export const EVENT_NAME = eventNames.EVENT_NAME
export type EVENT_NAME = eventNames.EventName

export const LAUNCH_SOURCE = launchSources.LAUNCH_SOURCE
export type LAUNCH_SOURCE = launchSources.LaunchSource

export const ERROR_CODE = errors.ERROR_CODE
export type ERROR_CODE = errors.ErrorCode

export const DEVICE_TYPE = deviceConstants.DEVICE_TYPE
export type DEVICE_TYPE = deviceConstants.DeviceType

export const DEVICE_OS = deviceConstants.DEVICE_OS
export type DEVICE_OS = deviceConstants.DeviceOs

export const DEVICE_ORIENTATION = deviceConstants.DEVICE_ORIENTATION
export type DEVICE_ORIENTATION = deviceConstants.DeviceOrientation

export const BANNER_POSITION = advertisementConstants.BANNER_POSITION
export type BANNER_POSITION = advertisementConstants.BannerPosition

export const BANNER_STATE = advertisementConstants.BANNER_STATE
export type BANNER_STATE = advertisementConstants.BannerState

export const INTERSTITIAL_STATE = advertisementConstants.INTERSTITIAL_STATE
export type INTERSTITIAL_STATE = advertisementConstants.InterstitialState

export const REWARDED_STATE = advertisementConstants.REWARDED_STATE
export type REWARDED_STATE = advertisementConstants.RewardedState

export const LEADERBOARD_TYPE = leaderboardsConstants.LEADERBOARD_TYPE
export type LEADERBOARD_TYPE = leaderboardsConstants.LeaderboardType

export const TASK_TYPE = tasksConstants.TASK_TYPE
export type TASK_TYPE = tasksTypes.TaskType

export const CROSS_PROMO_SOURCE = crossPromoConstants.CROSS_PROMO_SOURCE
export type CROSS_PROMO_SOURCE = crossPromoConstants.CrossPromoSource

export { BridgeError } from './constants/errors'

// CamelCase aliases of the same unions, for code that prefers them over the
// enum-style names above.
export type {
    PlatformId,
    PlatformMessage,
    VisibilityState,
} from './modules/platform/constants'
export type { ModuleName } from './constants/moduleName'
export type { EventName } from './constants/eventName'
export type { LaunchSource } from './constants/launchSource'
export type { ErrorCode } from './constants/errors'
export type {
    DeviceType,
    DeviceOs,
    DeviceOrientation,
} from './modules/device/constants'
export type {
    BannerPosition,
    BannerState,
    InterstitialState,
    RewardedState,
} from './modules/advertisement/constants'
export type { LeaderboardType } from './modules/leaderboards/constants'
export type { TaskType } from './modules/tasks/types'
export type { CrossPromoSource } from './modules/cross-promo/constants'

// Public data shapes returned by SDK modules.
export type { LeaderboardEntry } from './modules/leaderboards/types'
export type { CatalogProduct, Purchase } from './modules/payments/types'
export type { NormalizedAchievement } from './modules/achievements/types'
export type { Game } from './modules/cross-promo/types'
export type {
    Task,
    TaskTarget,
    TaskReward,
} from './modules/tasks/types'
export type { SafeAreaInsets } from './lib/safe-area'
export type { RemoteConfigContext } from './modules/remote-config/RemoteConfigModule'
export type { PlayerAuthorizeOptions } from './modules/player/PlayerModule'
