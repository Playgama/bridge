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
import { addJavaScript, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js'

class PokiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.POKI
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // clipboard
    get isClipboardSupported() {
        return false
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PokiSDK', 'init').then(() => {
                    this._platformSdk = window.PokiSDK
                    this._platformSdk.init().then(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.gameLoadingFinished()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED: {
                this._platformSdk.gameplayStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED: {
                this._platformSdk.gameplayStop()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // advertisement
    showInterstitial() {
        let isInterstitialOpened = false
        this._platformSdk.commercialBreak(() => {
            isInterstitialOpened = true
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        })
            .then(() => {
                if (isInterstitialOpened) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                } else {
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                }
            })
            .catch((error) => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED, error)
            })
    }

    showRewarded() {
        let isRewardedOpened = false
        this._platformSdk.rewardedBreak(() => {
            isRewardedOpened = true
            this._setRewardedState(REWARDED_STATE.OPENED)
        })
            .then((success) => {
                if (isRewardedOpened) {
                    if (success) {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    }

                    this._setRewardedState(REWARDED_STATE.CLOSED)
                } else {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                }
            })
            .catch((error) => {
                this._setRewardedState(REWARDED_STATE.FAILED, error)
            })
    }
}

export default PokiPlatformBridge
