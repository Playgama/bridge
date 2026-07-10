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
import type { DeviceType } from '../device/constants'
import type { BannerPosition } from './constants'

export interface PlacementMapping {
    id: string
    [platform: string]: string
}

export interface AdvancedBannersPlacementConfig {
    action?: string
    default?: unknown
    [key: string]: unknown
}

export interface AdvertisementOptions {
    banner?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
    }
    interstitial?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
        preloadOnStart?: string
    }
    rewarded?: {
        disable?: boolean
        placementFallback?: string
        placements?: PlacementMapping[]
        preloadOnStart?: string
    }
    advancedBanners?: {
        disable?: boolean
        placementFallback?: string
        [placement: string]: AdvancedBannersPlacementConfig | boolean | string | undefined
    }
    minimumDelayBetweenInterstitial?: number | string
    initialInterstitialDelay?: number | string
    useBuiltInErrorPopup?: boolean
    useAdvertisementErrorPopup?: boolean
    builtInErrorPopupCooldown?: number
}

export interface AdvertisementBridgeOptions {
    advertisement?: AdvertisementOptions
    [key: string]: unknown
}

export interface AdvertisementBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options: AdvertisementBridgeOptions
    isBannerSupported: boolean
    isAdvancedBannersSupported: boolean
    isInterstitialSupported: boolean
    isRewardedSupported: boolean
    isMinimumDelayBetweenInterstitialEnabled: boolean
    initialInterstitialDelay: number
    deviceType: DeviceType
    showBanner(position: BannerPosition, placement?: string | null): void
    hideBanner(): void
    preloadInterstitial(placement?: string | null): void
    showInterstitial(placement?: string | null): void
    preloadRewarded(placement?: string | null): void
    showRewarded(placement?: string | null): void
    showAdvancedBanners(config: unknown): void
    hideAdvancedBanners(): void
    checkAdBlock(): Promise<unknown>
}

export type { AnalyticsSender } from '../analytics'
