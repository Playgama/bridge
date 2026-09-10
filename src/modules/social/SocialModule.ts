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
import { deepMerge, type AnyRecord } from '../../utils'
import { getSocialPlatformData, getPostPlatformData } from './helpers'
import type {
    SocialBridgeContract,
    SocialMethod,
    SocialOptions,
    PostMapping,
    PostAuthorReward,
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

    // Rewards around posts created with createPost(): one for the player who
    // came to the game through a post, one for the author of that post. The
    // platform backend verifies who and when, the game decides what it grants.
    get isPostVisitRewardSupported(): boolean {
        return this._platformBridge.isPostVisitRewardSupported
    }

    get isPostAuthorRewardSupported(): boolean {
        return this._platformBridge.isPostAuthorRewardSupported
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

    // With `id` the content comes from the config `posts` entry of that id, so
    // the game passes nothing but the id. Without it the call behaves as before
    // and takes its content from the `social.createPost` config block.
    createPost(options?: SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isCreatePostSupported) {
            return Promise.reject()
        }

        const { id, ...content } = options ?? {}
        if (id === undefined) {
            return this._platformBridge.createPost(this.#resolve('createPost', options))
        }

        const post = this.#getPost(String(id))
        if (!post) {
            return Promise.reject()
        }

        // The rewards and their cooldown are read from the config again when the
        // game is launched from this post, so they are not part of its content.
        const postContent: AnyRecord = { ...post }
        delete postContent.rewards
        delete postContent.rewardCooldown

        return this._platformBridge.createPost(deepMerge(postContent, content))
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

    // Reward for the player who was launched from a post (see platform.data).
    // Resolves when the reward may be granted and rejects otherwise, the same
    // contract as getAddToHomeScreenReward(). The wait between rewards comes
    // from `rewardCooldown` of the post's config entry.
    getPostVisitReward(): Promise<unknown> {
        const { launchPostId } = this._platformBridge
        if (!this._platformBridge.isPostVisitRewardSupported || !launchPostId) {
            return Promise.reject()
        }

        const post = this.#getPost(launchPostId)
        return this._platformBridge.getPostVisitReward(post?.rewardCooldown)
    }

    // Reward for the author: how many players came to the game through their
    // posts since the previous call.
    getPostAuthorReward(): Promise<PostAuthorReward> {
        if (!this._platformBridge.isPostAuthorRewardSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getPostAuthorReward()
    }

    // Resolves a post declared in the config `posts` array for the active platform.
    #getPost(id: string): PostMapping | null {
        const { posts } = this._platformBridge.options
        return getPostPlatformData(posts, this._platformBridge.platformId, id)
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
