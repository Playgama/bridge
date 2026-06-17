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

// Canonical, platform-agnostic content the game passes at call time. Each
// platform bridge takes the subset it supports and maps the field to the
// native one (e.g. VK share `url` -> `link`, Discord share `image` -> `mediaUrl`).
// `image` accepts a base64 data-URI or an URL; the bridge converts to whatever
// form its platform needs. Extra platform-native keys are tolerated so config
// settings (groupId, isPage, status, ...) flow through the merge untouched.
export interface SocialOptions extends AnyRecord {
    text?: string
    image?: string
    url?: string
}

// Per-method config block: platform-id -> static platform data. Holds publisher
// settings (community ids, page flags) and optional defaults for the canonical
// content fields, which the game can override at call time.
export type SocialMethodConfig = Partial<Record<string, AnyRecord>>

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
