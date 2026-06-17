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
import type { SocialBridgeContract, SocialMethod, SocialOptions } from './types'

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

    inviteFriends(options?: SocialOptions): Promise<unknown> {
        return this._platformBridge.inviteFriends(this.#resolve('inviteFriends', options))
    }

    joinCommunity(options?: SocialOptions): Promise<unknown> {
        return this._platformBridge.joinCommunity(this.#resolve('joinCommunity', options))
    }

    share(options?: SocialOptions): Promise<unknown> {
        return this._platformBridge.share(this.#resolve('share', options))
    }

    createPost(options?: SocialOptions): Promise<unknown> {
        return this._platformBridge.createPost(this.#resolve('createPost', options))
    }

    addToHomeScreen(): Promise<unknown> {
        return this._platformBridge.addToHomeScreen()
    }

    getAddToHomeScreenReward(): Promise<unknown> {
        if (!this._platformBridge.isAddToHomeScreenRewardSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getAddToHomeScreenReward()
    }

    addToFavorites(): Promise<unknown> {
        return this._platformBridge.addToFavorites()
    }

    getAddToFavoritesReward(): Promise<unknown> {
        if (!this._platformBridge.isAddToFavoritesRewardSupported) {
            return Promise.reject()
        }

        return this._platformBridge.getAddToFavoritesReward()
    }

    rate(): Promise<unknown> {
        return this._platformBridge.rate()
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
            this._platformBridge.platformId,
            options,
        )
    }
}

export default SocialModule
