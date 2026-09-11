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
import type { PostRewardType } from './constants'

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

// One reward declared for a post. Data-only, mirroring the tasks module: `id`
// and `amount` are opaque to the bridge — the game decides what they mean and
// grants them. `type` says who gets it; without it the reward is for the player
// who came to the game through the post.
export interface PostRewardConfig {
    id: string
    amount: number
    type?: PostRewardType
}

// A reward social.getPostReward() hands to the game. For the author the amount
// is already multiplied by the number of players the backend counted.
export interface PostReward {
    id: string
    amount: number
    type: PostRewardType
}

// One post declared in the config `posts` array, addressed by `id` from
// social.createPost({ id }). `text`, `image` and `url` are the same canonical
// content fields as everywhere in social; a key named after a platform holds
// that platform's own fields and overrides the common ones on it. Any other
// key belongs to the game: the bridge forwards it untouched and hands it back
// as platform.data when the game is launched from this post.
export interface PostMapping extends AnyRecord {
    id: string
    text?: string
    image?: string
    url?: string
    rewards?: PostRewardConfig[]
    // Seconds the same player waits before the next post visit reward, verified
    // by the platform backend. The wait is counted per player across all posts
    // of the game, so opening ten posts in a row does not multiply the reward.
    // Omit it for a one-time reward.
    rewardCooldown?: number
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
    posts?: PostMapping[]
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
    isPostRewardSupported: boolean
    launchPostId: string | null
    inviteFriends(data?: AnyRecord): Promise<unknown>
    joinCommunity(data?: AnyRecord): Promise<unknown>
    share(data?: AnyRecord): Promise<unknown>
    createPost(data?: AnyRecord): Promise<unknown>
    addToHomeScreen(): Promise<unknown>
    getAddToHomeScreenReward(): Promise<unknown>
    addToFavorites(): Promise<unknown>
    getAddToFavoritesReward(): Promise<unknown>
    rate(): Promise<unknown>
    getPostVisitReward(cooldown?: number): Promise<unknown>
    // Players counted on the current player's posts since the previous call,
    // keyed by the config entry id of the post they came through.
    getPostAuthorReward(): Promise<Record<string, number>>
}
