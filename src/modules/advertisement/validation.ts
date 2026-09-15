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

import {
    ADVANCED_BANNER_PERCENT_PATTERN,
    ADVANCED_BANNER_POSITION_KEYS,
    ADVANCED_BANNER_SIZE_KEYS,
} from './constants'
import type { AdvancedBannerConfig } from './types'

// Results are cached per source array so repeated resolves return the same reference:
// the controller compares configs by identity to avoid needless hide/show churn.
const filteredBannersCache = new WeakMap<object, AdvancedBannerConfig[]>()

function isPercentValue(value: unknown): value is string {
    return typeof value === 'string' && ADVANCED_BANNER_PERCENT_PATTERN.test(value)
}

// Advanced banners are configured in percentages only: a banner must declare both
// sizes and at least one offset as percent values, so every platform can map it to
// its own placements. Anything else is a misconfiguration and never reaches the SDK.
function isValidBanner(banner: unknown): banner is AdvancedBannerConfig {
    if (!banner || typeof banner !== 'object') {
        return false
    }

    const config = banner as AdvancedBannerConfig

    if (!ADVANCED_BANNER_SIZE_KEYS.every((key) => isPercentValue(config[key]))) {
        return false
    }

    return ADVANCED_BANNER_POSITION_KEYS.some((key) => config[key] !== undefined)
        && ADVANCED_BANNER_POSITION_KEYS.every(
            (key) => config[key] === undefined || isPercentValue(config[key]),
        )
}

// Invalid banners are dropped one by one, so a single misconfigured entry does not
// take down the rest of the placement.
export function filterValidAdvancedBanners(banners: unknown): AdvancedBannerConfig[] {
    if (!Array.isArray(banners)) {
        return []
    }

    const cached = filteredBannersCache.get(banners)
    if (cached) {
        return cached
    }

    const valid = banners.filter(isValidBanner)
    filteredBannersCache.set(banners, valid)

    return valid
}
