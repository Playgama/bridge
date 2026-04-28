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

import ModuleBase, { type PlatformBridgeLike } from './ModuleBase'
import type { PlatformId } from '../constants'
import type { AnyRecord } from '../types/common'

export type SocialOptions = AnyRecord & Partial<Record<PlatformId, AnyRecord>>

export interface SocialBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isInviteFriendsSupported: boolean
    isJoinCommunitySupported: boolean
    isShareSupported: boolean
    isCreatePostSupported: boolean
    isAddToHomeScreenSupported: boolean
    isAddToHomeScreenRewardSupported: boolean
    isAddToFavoritesSupported: boolean
    isAddToFavoritesRewardSupported: boolean
    isRateSupported: boolean
    isExternalLinksAllowed: boolean
    inviteFriends(options?: SocialOptions): Promise<unknown>
    joinCommunity(options?: SocialOptions): Promise<unknown>
    share(options?: SocialOptions): Promise<unknown>
    createPost(options?: SocialOptions): Promise<unknown>
    addToHomeScreen(): Promise<unknown>
    getAddToHomeScreenReward(): Promise<unknown>
    addToFavorites(): Promise<unknown>
    getAddToFavoritesReward(): Promise<unknown>
    rate(): Promise<unknown>
}

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

    get isExternalLinksAllowed(): boolean {
        return this._platformBridge.isExternalLinksAllowed
    }

    inviteFriends(options?: SocialOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.inviteFriends(platformDependedOptions as SocialOptions)
            }
        }

        return this._platformBridge.inviteFriends(options)
    }

    joinCommunity(options?: SocialOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.joinCommunity(platformDependedOptions as SocialOptions)
            }
        }

        return this._platformBridge.joinCommunity(options)
    }

    share(options?: SocialOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.share(platformDependedOptions as SocialOptions)
            }
        }

        return this._platformBridge.share(options)
    }

    createPost(options?: SocialOptions): Promise<unknown> {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.createPost(platformDependedOptions as SocialOptions)
            }
        }

        return this._platformBridge.createPost(options)
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
}

export default SocialModule
