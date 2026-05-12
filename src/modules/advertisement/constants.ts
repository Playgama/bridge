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

import { DEVICE_ORIENTATION, DEVICE_TYPE } from '../device/constants'

export const BANNER_POSITION = {
    TOP: 'top',
    BOTTOM: 'bottom',
} as const
export type BannerPosition = typeof BANNER_POSITION[keyof typeof BANNER_POSITION]

export const BANNER_STATE = {
    LOADING: 'loading',
    SHOWN: 'shown',
    HIDDEN: 'hidden',
    FAILED: 'failed',
} as const
export type BannerState = typeof BANNER_STATE[keyof typeof BANNER_STATE]

export const INTERSTITIAL_STATE = {
    LOADING: 'loading',
    OPENED: 'opened',
    CLOSED: 'closed',
    FAILED: 'failed',
} as const
export type InterstitialState = typeof INTERSTITIAL_STATE[keyof typeof INTERSTITIAL_STATE]

export const REWARDED_STATE = {
    LOADING: 'loading',
    OPENED: 'opened',
    CLOSED: 'closed',
    FAILED: 'failed',
    REWARDED: 'rewarded',
} as const
export type RewardedState = typeof REWARDED_STATE[keyof typeof REWARDED_STATE]

export const ADVANCED_BANNERS_ACTION = {
    SHOW: 'show',
    HIDE: 'hide',
} as const
export type AdvancedBannersAction = typeof ADVANCED_BANNERS_ACTION[keyof typeof ADVANCED_BANNERS_ACTION]

export const BANNER_CONTAINER_ID = 'banner-container'
export const ADVANCED_BANNER_CONTAINER_ID_PREFIX = 'advanced-banner-'
export const INTERSTITIAL_CONTAINER_ID = 'interstitial-container'
export const REWARDED_CONTAINER_ID = 'rewarded-container'

export const DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL = 60
export const ADVANCED_BANNERS_CONDITIONS_DEBOUNCE = 200

export const ADVANCED_BANNERS_SCORE = {
    DEVICE_TYPE: 4,
    ORIENTATION: 2,
    DIMENSION: 1,
    CANVAS: 1,
}

export const DEVICE_TYPES_SET = new Set<string>(Object.values(DEVICE_TYPE))
export const ORIENTATIONS_SET = new Set<string>(Object.values(DEVICE_ORIENTATION))
