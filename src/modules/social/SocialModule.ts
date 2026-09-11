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
import { getSocialPlatformData, getPostPlatformData, getPostRewards } from './helpers'
import { POST_REWARD_TYPE } from './constants'
import type {
    SocialBridgeContract,
    SocialMethod,
    SocialOptions,
    PostMapping,
    PostReward,
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

    // Rewards around posts created with createPost(). The platform backend
    // verifies who is rewarded and when, the game decides what a reward means.
    get isPostRewardSupported(): boolean {
        return this._platformBridge.isPostRewardSupported
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

    // Takes either the id of a `posts` config entry, so the game passes nothing
    // but the id, or the content itself, which is how the method worked before
    // and still takes its defaults from the `social.createPost` config block.
    createPost(options?: string | SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isCreatePostSupported) {
            return Promise.reject()
        }

        if (typeof options !== 'string') {
            return this._platformBridge.createPost(this.#resolve('createPost', options))
        }

        const post = this.#getPost(options)
        if (!post) {
            return Promise.reject()
        }

        // The rewards and their cooldown are read from the config again when the
        // game is launched from this post, so they are not part of its content.
        const content: AnyRecord = { ...post }
        delete content.rewards
        delete content.rewardCooldown

        return this._platformBridge.createPost(content)
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

    // The rewards the player has coming from posts, already verified by the
    // platform backend and taken from the `rewards` of their config entries.
    // Launched from a post, it is the visit reward of that post, and the promise
    // rejects when the wait has not passed yet. Otherwise it is what the author
    // earned from the players who came through their posts since the last call.
    getPostReward(): Promise<PostReward[]> {
        if (!this._platformBridge.isPostRewardSupported) {
            return Promise.reject()
        }

        const { launchPostId } = this._platformBridge
        if (launchPostId) {
            const post = this.#getPost(launchPostId)
            return this._platformBridge
                .getPostVisitReward(post?.rewardCooldown)
                .then(() => getPostRewards(post, POST_REWARD_TYPE.VISIT, 1))
        }

        return this._platformBridge.getPostAuthorReward().then((counts) => Object.keys(counts)
            .flatMap((postId) => getPostRewards(
                this.#getPost(postId),
                POST_REWARD_TYPE.AUTHOR,
                counts[postId],
            )))
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
