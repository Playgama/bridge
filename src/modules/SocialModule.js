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

import ModuleBase from './ModuleBase'

class SocialModule extends ModuleBase {
    get isInviteFriendsSupported() {
        return this._platformBridge.isInviteFriendsSupported
    }

    get isJoinCommunitySupported() {
        return this._platformBridge.isJoinCommunitySupported
    }

    get isShareSupported() {
        return this._platformBridge.isShareSupported
    }

    get isCreatePostSupported() {
        return this._platformBridge.isCreatePostSupported
    }

    get isAddToHomeScreenSupported() {
        return this._platformBridge.isAddToHomeScreenSupported
    }

    get isAddToHomeScreenRewardSupported() {
        return this._platformBridge.isAddToHomeScreenRewardSupported
    }

    get isAddToFavoritesSupported() {
        return this._platformBridge.isAddToFavoritesSupported
    }

    get isRateSupported() {
        return this._platformBridge.isRateSupported
    }

    get isExternalLinksAllowed() {
        return this._platformBridge.isExternalLinksAllowed
    }

    inviteFriends(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.inviteFriends(platformDependedOptions)
            }
        }

        return this._platformBridge.inviteFriends(options)
    }

    joinCommunity(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.joinCommunity(platformDependedOptions)
            }
        }

        return this._platformBridge.joinCommunity(options)
    }

    share(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.share(platformDependedOptions)
            }
        }

        return this._platformBridge.share(options)
    }

    createPost(options) {
        if (options) {
            const platformDependedOptions = options[this._platformBridge.platformId]
            if (platformDependedOptions) {
                return this.createPost(platformDependedOptions)
            }
        }

        return this._platformBridge.createPost(options)
    }

    addToHomeScreen() {
        return this._platformBridge.addToHomeScreen()
    }

    getAddToHomeScreenReward() {
        return this._platformBridge.getAddToHomeScreenReward()
    }

    addToFavorites() {
        return this._platformBridge.addToFavorites()
    }

    rate() {
        return this._platformBridge.rate()
    }
}

export default SocialModule
