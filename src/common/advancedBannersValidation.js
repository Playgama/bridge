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
} from '../constants'

// Results are cached per source array so repeated resolves return the same reference:
// the module compares configs by identity to avoid needless hide/show churn.
const filteredBannersCache = new WeakMap()

function isPercentValue(value) {
    return typeof value === 'string' && ADVANCED_BANNER_PERCENT_PATTERN.test(value)
}

// A zero offset is unit-independent, so it is accepted without the percent sign.
function isOffsetValue(value) {
    return value === 0 || value === '0' || isPercentValue(value)
}

// Advanced banners are configured in percentages only: a banner must declare both
// sizes and at least one offset as percent values (or zero), so every platform can map it to
// its own placements. Anything else is a misconfiguration and never reaches the SDK.
function isValidBanner(banner) {
    if (!banner || typeof banner !== 'object') {
        return false
    }

    if (!ADVANCED_BANNER_SIZE_KEYS.every((key) => isPercentValue(banner[key]))) {
        return false
    }

    return ADVANCED_BANNER_POSITION_KEYS.some((key) => banner[key] !== undefined)
        && ADVANCED_BANNER_POSITION_KEYS.every(
            (key) => banner[key] === undefined || isOffsetValue(banner[key]),
        )
}

// Invalid banners are dropped one by one, so a single misconfigured entry does not
// take down the rest of the placement.
export function filterValidAdvancedBanners(banners) {
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
