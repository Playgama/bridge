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
} from '../constants'

class HuaweiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.HUAWEI
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // advertisement
    get isAdvertisementSupported() {
        return true
    }

    get _isChineseDevice() {
        return typeof window.HwFastappObject === 'object'
    }

    async initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.appid
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.HUAWEI_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this._appId = this._options.appid

                if (this._isChineseDevice) {
                    promiseDecorator.resolve()

                    this._platformSdk = window.HwFastappObject
                } else {
                    // Fallback for non-Chinese devices

                    promiseDecorator.resolve()
                }
            }
        }

        return promiseDecorator.promise
    }

    authorizePlayer() {
        if (this._isChineseDevice) {
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            if (!this._platformSdk) {
                reject(ERROR.SDK_NOT_INITIALIZED)
                return
            }

            this._platformSdk.onGameLoginResult = function onGameLoginResult({
                code,
                data,
                gameUserData,
            }) {
                if (code === 0) {
                    const {
                        playerId,
                        displayName,
                        // playerLevel,
                        // ts,
                        // gameAuthSign,
                        hiResImageUri,
                        imageUri,
                    } = gameUserData

                    this._playerId = playerId
                    this._playerName = displayName

                    if (imageUri) {
                        this._playerPhotos.push(imageUri)
                    }

                    if (hiResImageUri) {
                        this._playerPhotos.push(hiResImageUri)
                    }

                    this._isPlayerAuthorized = true
                    resolve()
                } else {
                    reject(JSON.stringify({ data, code }))
                }
            }

            this._platformSdk.gameLogin(JSON.stringify({
                appid: this._appId,
                forceLogin: '1',
            }))
        })
    }

    // advertisement
    showInterstitial() {
        const messageHandler = (event) => {
            if (event.message !== 'nativeAdReady') {
                return
            }

            if (event.error) {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.SHOWN)
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }

            window.removeEventListener('message', messageHandler)
        }

        window.addEventListener('message', messageHandler)

        window.parent.postMessage({ message: 'requestNativeAd' }, '*')
    }

    showRewarded() {
        const messageHandler = (event) => {
            if (event.message !== 'rewardedAdReady') {
                return
            }

            if (event.error) {
                this._setInterstitialState(REWARDED_STATE.FAILED)
            } else {
                this._setInterstitialState(REWARDED_STATE.SHOWN)
                this._setInterstitialState(REWARDED_STATE.CLOSED)
            }

            window.removeEventListener('message', messageHandler)
        }

        window.addEventListener('message', messageHandler)

        window.parent.postMessage({ message: 'requestRewardedAd' }, '*')
    }
}

export default HuaweiPlatformBridge
