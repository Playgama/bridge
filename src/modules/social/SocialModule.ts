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
import {
    getSocialPlatformData, getSocialContent, getPostPlatformData, getPostRewards,
} from './helpers'
import { POST_REWARD_TYPE } from './constants'
import type {
    SocialBridgeContract,
    SocialMethod,
    SocialOptions,
    SocialContentMapping,
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

    inviteFriends(options?: string | SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isInviteFriendsSupported) {
            return Promise.reject()
        }

        if (typeof options !== 'string') {
            return this._platformBridge.inviteFriends(this.#resolve('inviteFriends', options))
        }

        const content = this.#getContent(this._platformBridge.options.social?.invites, options)
        if (!content) {
            return Promise.reject()
        }

        return this._platformBridge.inviteFriends(content)
    }

    joinCommunity(options?: SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isJoinCommunitySupported) {
            return Promise.reject()
        }

        return this._platformBridge.joinCommunity(this.#resolve('joinCommunity', options))
    }

    share(options?: string | SocialOptions): Promise<unknown> {
        if (!this._platformBridge.isShareSupported) {
            return Promise.reject()
        }

        if (typeof options !== 'string') {
            return this._platformBridge.share(this.#resolve('share', options))
        }

        const content = this.#getContent(this._platformBridge.options.social?.shares, options)
        if (!content) {
            return Promise.reject()
        }

        return this._platformBridge.share(content)
    }

    // Takes either the id of a `posts` config entry, so the game passes nothing
    // but the id, or the content itself, which is how the method worked before
    // and still takes its defaults from the `social.createPost` config block.
    // `payload` is the game's own string for this one post — a level, a seed, a
    // challenge — handed back as platform.payload when someone opens it.
    createPost(options?: string | SocialOptions, payload?: string): Promise<unknown> {
        if (!this._platformBridge.isCreatePostSupported) {
            return Promise.reject()
        }

        if (typeof options !== 'string') {
            return this._platformBridge.createPost(this.#resolve('createPost', options))
        }

        const content = this.#getContent(this._platformBridge.options.social?.posts, options)
        if (!content) {
            return Promise.reject()
        }

        // The id and the payload travel beside the content, not inside it:
        // platforms that can remember them take them, the rest ignore them.
        return this._platformBridge.createPost(content, {
            id: options,
            ...(payload === undefined ? {} : { payload }),
        })
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

    // Everything the player has coming from posts right now, verified by the
    // platform backend and taken from the `rewards` of the config entries: the
    // reward for the post the game was launched from, when it may be granted,
    // and what the author earned from the players who came through their posts.
    // Resolves with an empty array when there is nothing, so a game grants what
    // it gets and stays quiet otherwise.
    getPostReward(): Promise<PostReward[]> {
        if (!this._platformBridge.isPostRewardSupported) {
            return Promise.reject()
        }

        return Promise.all([this.#getVisitRewards(), this.#getAuthorRewards()])
            .then(([visit, author]) => [...visit, ...author])
    }

    // The reward for the launch post. Nothing is asked of the backend when the
    // game was not launched from a post or that post declares no visit reward,
    // so the player's cooldown is not spent for nothing.
    #getVisitRewards(): Promise<PostReward[]> {
        const { launchPostId } = this._platformBridge
        const post = launchPostId ? this.#getPost(launchPostId) : null
        const rewards = getPostRewards(post, POST_REWARD_TYPE.VISIT, 1)
        if (!post || rewards.length === 0) {
            return Promise.resolve([])
        }

        return this._platformBridge
            .getPostVisitReward(post.rewardCooldown)
            .then(() => rewards)
            .catch(() => [])
    }

    // What the author earned since the previous call, by the config entry of
    // the post each player came through.
    #getAuthorRewards(): Promise<PostReward[]> {
        return this._platformBridge.getPostAuthorReward()
            .then((counts) => Object.keys(counts).flatMap((postId) => getPostRewards(
                this.#getPost(postId),
                POST_REWARD_TYPE.AUTHOR,
                counts[postId],
            )))
            .catch(() => [])
    }

    // Resolves a `social.shares`, `social.invites` or `social.posts` entry to its content for the active platform.
    #getContent(entries: SocialContentMapping[] | undefined, id: string): AnyRecord | null {
        return getSocialContent(entries, this._platformBridge.platformId, id)
    }

    // Resolves a post declared in `social.posts` for the active platform.
    #getPost(id: string): PostMapping | null {
        const posts = this._platformBridge.options.social?.posts
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
