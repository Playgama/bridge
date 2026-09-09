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
import type { AnyRecord } from '../../utils'

// Social methods that resolve their data from the config mapping.
export type SocialMethod = 'share' | 'inviteFriends' | 'joinCommunity' | 'createPost'

// Content the game passes at call time. `text`/`image`/`url` are the canonical,
// platform-agnostic fields each bridge maps to its native one (e.g. VK `url` ->
// `link`, Discord `image` -> `mediaUrl`); `image` accepts a base64 data-URI or an
// URL and the bridge converts as needed. Any OTHER key is forwarded verbatim to the
// platform SDK call, so games/config can pass raw platform-specific fields
// (VK `attachments`, OK `media` polls, Facebook `intent`, ...) without an SDK change.
export interface SocialOptions extends AnyRecord {
    text?: string
    image?: string
    url?: string
}

// Per-method config block: the social data for one method (publisher settings like
// community ids/page flags, optional defaults for the canonical content fields, and
// `native`). It is platform-resolved before the module reads it: put common values
// in the top-level `social[method]` block and platform-specific overrides in
// `platforms[id].social[method]` — the config loader deep-merges them. So there is
// no platform key here; the game can still override any of it at call time.
export type SocialMethodConfig = SocialOptions

export interface SocialConfig {
    share?: SocialMethodConfig
    inviteFriends?: SocialMethodConfig
    joinCommunity?: SocialMethodConfig
    createPost?: SocialMethodConfig
}

export interface SocialBridgeOptions extends AnyRecord {
    social?: SocialConfig
}

export interface SocialBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    options: SocialBridgeOptions
    isInviteFriendsSupported: boolean
    isJoinCommunitySupported: boolean
    isShareSupported: boolean
    isCreatePostSupported: boolean
    isAddToHomeScreenSupported: boolean
    isAddToHomeScreenRewardSupported: boolean
    isAddToFavoritesSupported: boolean
    isAddToFavoritesRewardSupported: boolean
    isRateSupported: boolean
    inviteFriends(data?: AnyRecord): Promise<unknown>
    joinCommunity(data?: AnyRecord): Promise<unknown>
    share(data?: AnyRecord): Promise<unknown>
    createPost(data?: AnyRecord): Promise<unknown>
    addToHomeScreen(): Promise<unknown>
    getAddToHomeScreenReward(): Promise<unknown>
    addToFavorites(): Promise<unknown>
    getAddToFavoritesReward(): Promise<unknown>
    rate(): Promise<unknown>
}
