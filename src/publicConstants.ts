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

// The surface an npm consumer is allowed to import. Everything re-exported here
// is part of the package contract; everything else in `src/` is an internal
// detail that may move between releases.
//
// Each enum-like object is exported twice on purpose — once as a value and once
// as the union type of its members. That is what lets a game write both
// `EVENT_NAME.REWARDED_STATE_CHANGED` and `(name: EVENT_NAME) => void` without
// importing two different identifiers.

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

// Re-exporting `{ PLATFORM_ID }` and `type { PlatformId as PLATFORM_ID }` from
// the same module is a duplicate identifier: one `export ... from` alias lands
// in both declaration spaces at once. Binding the value and declaring the type
// separately is what keeps one name usable in both positions.
/* eslint-disable @typescript-eslint/no-redeclare */
export const { MODULE_NAME } = moduleNames
export type MODULE_NAME = moduleNames.ModuleName

export const { EVENT_NAME } = eventNames
export type EVENT_NAME = eventNames.EventName

export const { LAUNCH_SOURCE } = launchSources
export type LAUNCH_SOURCE = launchSources.LaunchSource

export const { ERROR_CODE } = errors
export type ERROR_CODE = errors.ErrorCode

export const { PLATFORM_ID, PLATFORM_MESSAGE, VISIBILITY_STATE } = platformConstants
export type PLATFORM_ID = platformConstants.PlatformId
export type PLATFORM_MESSAGE = platformConstants.PlatformMessage
export type VISIBILITY_STATE = platformConstants.VisibilityState

export const { DEVICE_TYPE, DEVICE_OS, DEVICE_ORIENTATION } = deviceConstants
export type DEVICE_TYPE = deviceConstants.DeviceType
export type DEVICE_OS = deviceConstants.DeviceOs
export type DEVICE_ORIENTATION = deviceConstants.DeviceOrientation

export const {
    BANNER_POSITION, BANNER_STATE, INTERSTITIAL_STATE, REWARDED_STATE,
} = advertisementConstants
export type BANNER_POSITION = advertisementConstants.BannerPosition
export type BANNER_STATE = advertisementConstants.BannerState
export type INTERSTITIAL_STATE = advertisementConstants.InterstitialState
export type REWARDED_STATE = advertisementConstants.RewardedState

export const { LEADERBOARD_TYPE } = leaderboardsConstants
export type LEADERBOARD_TYPE = leaderboardsConstants.LeaderboardType

export const { CROSS_PROMO_SOURCE } = crossPromoConstants
export type CROSS_PROMO_SOURCE = crossPromoConstants.CrossPromoSource

export const { TASK_TYPE } = tasksConstants
export type TASK_TYPE = tasksTypes.TaskType
export { BridgeError } from './constants/errors'

// The same members under their camel-case type names, for code that prefers
// `PlatformId` to `PLATFORM_ID` in type position.
export type { ModuleName } from './constants/moduleName'
export type { EventName } from './constants/eventName'
export type { LaunchSource } from './constants/launchSource'
export type { ErrorCode } from './constants/errors'
export type { PlatformId, PlatformMessage, VisibilityState } from './modules/platform/constants'
export type { DeviceType, DeviceOs, DeviceOrientation } from './modules/device/constants'
export type {
    BannerPosition,
    BannerState,
    InterstitialState,
    RewardedState,
} from './modules/advertisement/constants'
export type { LeaderboardType } from './modules/leaderboards/constants'
export type { CrossPromoSource } from './modules/cross-promo/constants'

// Shapes a game receives from the SDK and has to name in its own code.
export type {
    TaskType, Task, TaskTarget, TaskReward,
} from './modules/tasks/types'
export type { Game } from './modules/cross-promo/types'
export type { NormalizedAchievement } from './modules/achievements/types'
export type { SafeAreaInsets } from './lib/safe-area/types'
export type { RemoteConfigContext } from './modules/remote-config/RemoteConfigModule'
export type { PlayerAuthorizeOptions } from './modules/player/PlayerModule'
