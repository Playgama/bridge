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
    STORAGE_TYPE,
    ERROR,
} from '../constants'

const SDK_URL = 'https://developer.playgama.com/sdk/v1.js'

class PlaygamaPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.PLAYGAMA
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PLAYGAMA_SDK').then(() => {
                    this._platformSdk = window.PLAYGAMA_SDK
                    this.#getPlayer().then(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // storage
    setDataToStorage(key, value, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = (typeof value[i] !== 'string') ? JSON.stringify(value[i]) : value[i]
                    }
                } else {
                    data[key] = (typeof value !== 'string') ? JSON.stringify(value) : value
                }

                this._platformSdk.storageApi.setItems(data)
                return super.setDataToStorage(key, value, storageType)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    deleteDataFromStorage(key, storageType) {
        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                this._platformSdk.storageApi.deleteItems(Array.isArray(key) ? key : [key])
                return super.deleteDataFromStorage(key, storageType)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    // advertisement
    showInterstitial() {
        this._platformSdk.advService.showInterstitial({
            onOpen: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            onEmpty: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            },
            onClose: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            },
            onError: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            },
        })
    }

    showRewarded() {
        this._platformSdk.advService.showRewarded({
            onOpen: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            onRewarded: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            onEmpty: () => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            },
            onClose: () => {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            },
            onError: () => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            },
        })
    }

    authorizePlayer(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this.#getPlayer(options)
                    .then(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                    })
            } else {
                this._platformSdk.userService.authorizeUser()
                    .then(() => {
                        this.#getPlayer(options)
                            .then(() => {
                                this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                            })
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                    })
            }
        }

        return promiseDecorator.promise
    }

    #getPlayer() {
        return new Promise((resolve) => {
            this._platformSdk.userService.getUser()
                .then((player) => {
                    this._playerId = player.id
                    this._isPlayerAuthorized = player.isAuthorized
                    this._playerName = player.name
                    this._playerPhotos = player.photos
                })
                .finally(() => {
                    resolve()
                })
        })
    }
}

export default PlaygamaPlatformBridge
