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

import ModuleBase from '../ModuleBase'
import type { AnyRecord } from '../../utils'
import { getSocialPlatformData } from './helpers'
import type {
    SocialBridgeContract,
    SocialMethod,
    SocialOptions,
    CreatePostOptions,
    ClaimOptions,
    ClaimResult,
    InboxOptions,
    Inbox,
} from './types'

class SocialModule extends ModuleBase<SocialBridgeContract> {
    get isInviteFriendsSupported(): boolean {
        return this._platformBridge.isInviteFriendsSupported
    }

    get isJoinCommunitySupported(): boolean {
        return this._platformBridge.isJoinCommunitySupported
    }

    get isShareSupported(): boolean {
        return this._platformBridge.isShareSupported
    }

    get isCreatePostSupported(): boolean {
        return this._platformBridge.isCreatePostSupported
    }

    get isAddToHomeScreenSupported(): boolean {
        return this._platformBridge.isAddToHomeScreenSupported
    }

    get isAddToHomeScreenRewardSupported(): boolean {
        return this._platformBridge.isAddToHomeScreenRewardSupported
    }

    get isAddToFavoritesSupported(): boolean {
        return this._platformBridge.isAddToFavoritesSupported
    }

    get isAddToFavoritesRewardSupported(): boolean {
        return this._platformBridge.isAddToFavoritesRewardSupported
    }

    get isRateSupported(): boolean {
        return this._platformBridge.isRateSupported
    }

    // Claims: other players act on a post created with createPost({ claimable: true }).
    // The backend verifies who claimed and when; what a claim grants is the game's.
    get isClaimSupported(): boolean {
        return this._platformBridge.isClaimSupported
    }

    get isInboxSupported(): boolean {
        return this._platformBridge.isInboxSupported
    }

    inviteFriends(options?: SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isInviteFriendsSupported) {
            return Promise.reject()
        }

        return this._platformBridge.inviteFriends(this.#resolve('inviteFriends', options))
    }

    joinCommunity(options?: SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isJoinCommunitySupported) {
            return Promise.reject()
        }

        return this._platformBridge.joinCommunity(this.#resolve('joinCommunity', options))
    }

    share(options?: SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isShareSupported) {
            return Promise.reject()
        }

        return this._platformBridge.share(this.#resolve('share', options))
    }

    createPost(options?: CreatePostOptions): Promise<unknown> {
        if (!this._platformBridge.isCreatePostSupported) {
            return Promise.reject()
        }

        // `data` is opaque game JSON and `claimable` is a per-post decision: keep
        // them out of the config merge (deepMerge would reshape arrays inside `data`).
        const { data, claimable, ...content } = options ?? {}
        const resolved: AnyRecord = this.#resolve('createPost', content)
        delete resolved.data
        delete resolved.claimable
        if (data !== undefined) {
            resolved.data = data
        }
        if (claimable !== undefined) {
            resolved.claimable = claimable
        }

        return this._platformBridge.createPost(resolved)
    }

    addToHomeScreen(): Promise<unknown> {
        if (!this._platformBridge.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        return this._platformBridge.addToHomeScreen()
    }

    getAddToHomeScreenReward(): Promise<unknown> {
        if (!this._platformBridge.isAddToHomeScreenRewardSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getAddToHomeScreenReward()
    }

    addToFavorites(): Promise<unknown> {
        if (!this._platformBridge.isAddToFavoritesSupported) {
            return Promise.reject()
        }

        return this._platformBridge.addToFavorites()
    }

    getAddToFavoritesReward(): Promise<unknown> {
        if (!this._platformBridge.isAddToFavoritesRewardSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getAddToFavoritesReward()
    }

    rate(): Promise<unknown> {
        if (!this._platformBridge.isRateSupported) {
            return Promise.reject()
        }

        return this._platformBridge.rate()
    }

    // Claim on the post the game was launched from (see platform.launchData).
    // The claim policy (cooldown, scope) resolves like other social data:
    // `social.claim` config defaults, runtime options on top.
    claim(options: ClaimOptions = {}): Promise<ClaimResult> {
        if (!this._platformBridge.isClaimSupported) {
            return Promise.reject()
        }

        return this._platformBridge.claim(this.#resolve('claim', options) as ClaimOptions)
    }

    // Claims other players made on the current player's posts.
    getInbox(options: InboxOptions = {}): Promise<Inbox> {
        if (!this._platformBridge.isInboxSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getInbox(options)
    }

    // Resolves the platform data for a method: static config (community ids,
    // page flags, default content) merged with the game's runtime options.
    // A future SaaS social backend would branch here, mirroring LeaderboardsModule
    // (initialize() sets up the SaaS client when `_isSaas('social')`, and each
    // method routes through it before falling back to the platform bridge).
    #resolve(method: SocialMethod, options?: SocialOptions): AnyRecord {
        return getSocialPlatformData(
            this._platformBridge.options?.social,
            method,
            options,
        )
    }
}

export default SocialModule
