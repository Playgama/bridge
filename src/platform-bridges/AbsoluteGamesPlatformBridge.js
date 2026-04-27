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
import { addJavaScript } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
} from '../constants'

const SDK_URL = 'https://unpkg.com/@agru/sdk/dist/umd/index.min.js'

class AbsoluteGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.ABSOLUTE_GAMES
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady() {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                this._platformSdk = new window.AgRuSdk()

                this._platformSdk.on(window.AgRuSdkMethods.ShowCampaign, (data, error) => {
                    switch (data.type) {
                        case 'rewarded': {
                            if (error === null) {
                                if (data.status) {
                                    this._setRewardedState(REWARDED_STATE.OPENED)
                                } else {
                                    if (data.reward) {
                                        this._setRewardedState(REWARDED_STATE.REWARDED)
                                    }

                                    this._setRewardedState(REWARDED_STATE.CLOSED)
                                }
                            } else {
                                this._showAdFailurePopup(true)
                            }
                            break
                        }
                        case 'default': // A valid value for the property, just to denote it
                        default: {
                            if (error === null) {
                                if (data.status) {
                                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                } else {
                                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                }
                            } else {
                                this._showAdFailurePopup(false)
                            }
                            break
                        }
                    }
                })

                const getPlayerInfoPromise = this.#getPlayerInfo()

                Promise
                    .all([getPlayerInfoPromise])
                    .finally(() => {
                        this._isInitialized = true

                        this._setDefaultStorageType(
                            this._isPlayerAuthorized
                                ? STORAGE_TYPE.PLATFORM_INTERNAL
                                : STORAGE_TYPE.LOCAL_STORAGE,
                        )

                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.authorize((data, error) => {
                if (error === null) {
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                }
            })
        }

        return promiseDecorator.promise
    }

    // storage
    loadCloudSnapshot() {
        return new Promise((resolve, reject) => {
            this._platformSdk.getSaveData((data, error) => {
                if (error === null) {
                    resolve(data || {})
                } else {
                    reject(error)
                }
            })
        })
    }

    saveCloudSnapshot(snapshot) {
        return new Promise((resolve, reject) => {
            this._platformSdk.setSaveData(snapshot, (result, error) => {
                if (error === null) {
                    resolve()
                } else {
                    reject(error)
                }
            })
        })
    }

    deleteCloudKeys(snapshot) {
        return this.saveCloudSnapshot(snapshot)
    }

    // advertisement
    showInterstitial() {
        this._platformSdk.showCampaign('default')
    }

    showRewarded() {
        this._platformSdk.showCampaign('rewarded')
    }

    #getPlayerInfo() {
        this._playerId = this._platformSdk.options.player_id
        this._isPlayerAuthorized = this._platformSdk.options.guest === 'false'

        return new Promise((resolve) => {
            this._platformSdk.getUsers([this._playerId], (data) => {
                if (data && data.length === 1) {
                    const playerData = data[0]
                    this._playerName = playerData.full_name

                    if (playerData.avatar !== '') {
                        this._playerPhotos = [playerData.avatar]
                    }
                }

                resolve()
            })
        })
    }
}

export default AbsoluteGamesPlatformBridge
