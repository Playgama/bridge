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

import { PLATFORM_ID, type PlatformId } from './modules/platform/constants'

export interface PlatformDetectorContext {
    url: URL
    hostname: string
    hash: string
    searchParams: URLSearchParams
    referrer: string
    win: Window
}

export interface PlatformDetector {
    platformId: PlatformId
    predicate: (ctx: PlatformDetectorContext) => boolean
}

// Ordered list of platform auto-detectors. First match wins.
// Each entry is conditionally included based on the build-time __INCLUDE_*__ flag
// so platforms excluded from the bundle do not ship their detector code.
export const PLATFORM_DETECTORS: PlatformDetector[] = [
    ...(__INCLUDE_YANDEX__ ? [{
        platformId: PLATFORM_ID.YANDEX,
        predicate: ({ hostname, hash }: PlatformDetectorContext) => hostname.includes(['y', 'a', 'n', 'd', 'e', 'x', '.', 'n', 'e', 't'].join('')) || hash.includes('yandex'),
    }] : []),
    ...(__INCLUDE_CRAZY_GAMES__ ? [{
        platformId: PLATFORM_ID.CRAZY_GAMES,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('crazygames.') || hostname.includes('1001juegos.com'),
    }] : []),
    ...(__INCLUDE_GAME_DISTRIBUTION__ ? [{
        platformId: PLATFORM_ID.GAME_DISTRIBUTION,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('gamedistribution.com'),
    }] : []),
    ...(__INCLUDE_LAGGED__ ? [{
        platformId: PLATFORM_ID.LAGGED,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('lagged.'),
    }] : []),
    ...(__INCLUDE_VK__ ? [{
        platformId: PLATFORM_ID.VK,
        predicate: ({ searchParams }: PlatformDetectorContext) => (searchParams.has('api_id') && searchParams.has('viewer_id') && searchParams.has('auth_key')) || searchParams.has('vk_app_id'),
    }] : []),
    ...(__INCLUDE_ABSOLUTE_GAMES__ ? [{
        platformId: PLATFORM_ID.ABSOLUTE_GAMES,
        predicate: ({ searchParams }: PlatformDetectorContext) => searchParams.has('app_id') && searchParams.has('player_id') && searchParams.has('game_sid') && searchParams.has('auth_key'),
    }] : []),
    ...(__INCLUDE_PLAYDECK__ ? [{
        platformId: PLATFORM_ID.PLAYDECK,
        predicate: ({ searchParams }: PlatformDetectorContext) => searchParams.has('playdeck'),
    }] : []),
    ...(__INCLUDE_TELEGRAM__ ? [{
        platformId: PLATFORM_ID.TELEGRAM,
        predicate: ({ hash }: PlatformDetectorContext) => hash.includes('tgWebAppData'),
    }] : []),
    ...(__INCLUDE_Y8__ ? [{
        platformId: PLATFORM_ID.Y8,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('y8'),
    }] : []),
    ...(__INCLUDE_FACEBOOK__ ? [{
        platformId: PLATFORM_ID.FACEBOOK,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('fbsbx'),
    }] : []),
    ...(__INCLUDE_POKI__ ? [{
        platformId: PLATFORM_ID.POKI,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('poki-gdn') || hostname.includes('poki-user-content'),
    }] : []),
    ...(__INCLUDE_MSN__ ? [{
        platformId: PLATFORM_ID.MSN,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('msn.') || hostname.includes('msnfun.') || hostname.includes('start.gg'),
    }] : []),
    ...(__INCLUDE_BITQUEST__ ? [{
        platformId: PLATFORM_ID.BITQUEST,
        predicate: ({ hash, referrer }: PlatformDetectorContext) => hash.includes('customUrl_') || referrer.includes('bitquest'),
    }] : []),
    ...(__INCLUDE_GAMEPUSH__ ? [{
        platformId: PLATFORM_ID.GAMEPUSH,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('eponesh.'),
    }] : []),
    ...(__INCLUDE_DISCORD__ ? [{
        platformId: PLATFORM_ID.DISCORD,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('discordsays.com'),
    }] : []),
    ...(__INCLUDE_YOUTUBE__ ? [{
        platformId: PLATFORM_ID.YOUTUBE,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('usercontent.goog'),
    }] : []),
    ...(__INCLUDE_PORTAL__ ? [{
        platformId: PLATFORM_ID.PORTAL,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('portalapp.'),
    }] : []),
    ...(__INCLUDE_REDDIT__ ? [{
        platformId: PLATFORM_ID.REDDIT,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('devvit.'),
    }] : []),
    ...(__INCLUDE_DLIGHTEK__ ? [{
        platformId: PLATFORM_ID.DLIGHTEK,
        predicate: ({ hostname }: PlatformDetectorContext) => hostname.includes('hippoobox.com') || hostname.includes('ahagamecenter.com'),
    }] : []),
    ...(__INCLUDE_TIKTOK__ ? [{
        platformId: PLATFORM_ID.TIKTOK,
        predicate: ({ win }: PlatformDetectorContext) => typeof win.TTMinis !== 'undefined',
    }] : []),
    ...(__INCLUDE_GAMESNACKS__ ? [{
        platformId: PLATFORM_ID.GAMESNACKS,
        predicate: ({ win }: PlatformDetectorContext) => typeof win.GameSnacks !== 'undefined',
    }] : []),
    ...(__INCLUDE_SAMSUNG__ ? [{
        platformId: PLATFORM_ID.SAMSUNG,
        predicate: ({ win }: PlatformDetectorContext) => typeof win.GSInstant !== 'undefined',
    }] : []),
]
