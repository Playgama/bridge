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

import PlatformBridgeBase from './PlatformBridgeBase'
import {
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../constants'

class XiaomiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.XIAOMI
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.devId
                || !this._options.publisherId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.XIAOMI_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            }
        }

        return promiseDecorator.promise
    }

    // advertisement
    showBanner() {
        this._setBannerState(BANNER_STATE.FAILED)
    }

    hideBanner() {
        this._setBannerState(BANNER_STATE.FAILED)
    }

    showInterstitial() {
        this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
    }

    showRewarded() {
        this._setRewardedState(REWARDED_STATE.FAILED)
    }
}

export default XiaomiPlatformBridge
