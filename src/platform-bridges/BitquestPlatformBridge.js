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
    STORAGE_TYPE,
    ERROR,
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'

class GamePushPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.GAMEPUSH
    }

    _isBannerSupported = true

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options
                || !this._options.projectId
                || !this._options.publicToken
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAMEPUSH_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                const SDK_URL = `https://games.bitquest.games/bqsdk.min.js`
                
                addJavaScript(SDK_URL).then(() => {
                    waitFor('bq').then(() => {
                        this._platformSdk = window.bq
                        const player = this._platformSdk?.player
                        if (player) {
                            const { id = null, name = ''} = player
                            this._playerId = id
                            this._playerName = name
                        } else {
                            console.warn('[Player Init] platformSdk.player is not available')
                        }
                        this._isInitialized = true

                        this.setupInterstitialHandlers()
                        this.setupRewardedHandlers()

                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    setupRewardedHandlers() {
        this._platformSdk.ads.on('rewarded:start', () => {
            console.info('Rewarded ad started')
        })

        this._platformSdk.ads.on('rewarded:close', (success) => {
            if (!success) {
                this._setRewardedState(REWARDED_STATE.FAILED)
            } else {
                // this._setRewardedState(REWARDED_STATE.CLOSED)
            }
        })

        this._platformSdk.ads.on('rewarded:reward', () => {
            this._setRewardedState(REWARDED_STATE.REWARDED)
            this._setRewardedState(REWARDED_STATE.CLOSED)
        })
    }

    setupInterstitialHandlers() {
        this._platformSdk.ads.on('fullscreen:start', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        })

        this._platformSdk.ads.on('fullscreen:close', () => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })
    }

    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._platformSdk.player.isLoggedIn;
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._platformSdk.player.isLoggedIn
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                if (Array.isArray(key)) {
                    const values = []
                    key.forEach((k) => {
                        let value = this._platformSdk.player.get(k)

                        if (tryParseJson) {
                            try {
                                value = JSON.parse(value)
                            } catch (e) {
                                // keep value string or null
                            }
                        }
                        values.push(value)
                    })

                    resolve(values)
                    return
                }

                let value = this._platformSdk.player.get(key)

                if (tryParseJson) {
                    try {
                        value = JSON.parse(value)
                    } catch (e) {
                        // keep value string or null
                    }
                }
                resolve(value)
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        let valueData = value[i]

                        if (typeof value[i] !== 'string') {
                            valueData = JSON.stringify(value[i])
                        }

                        this._platformSdk.player.set(key[i], valueData)
                    }

                    resolve()
                    return
                }

                let valueData = value

                if (typeof value !== 'string') {
                    valueData = JSON.stringify(value)
                }

                this._platformSdk.player.set(key, valueData)
                this._platformSdk.player.sync()
                resolve()
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                key.forEach((k) => this._platformSdk.data.removeItem(k))
                return Promise.resolve()
            }

            this._platformSdk.data.removeItem(key)
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    showInterstitial() {
        this._platformSdk.ads.showFullscreen()
    }

    showRewarded() {
        this._setRewardedState(REWARDED_STATE.OPENED)

        this._platformSdk.ads.showRewardedVideo()
            .catch(() => {
                this._setRewardedState(REWARDED_STATE.FAILED)
            })
    }

    showBanner() {
        this._platformSdk.ads.off('sticky:render')
        this._platformSdk.ads.off('sticky:close')
        this._platformSdk.ads.on('sticky:render', () => {
            this._setBannerState(BANNER_STATE.SHOWN)
        })

        this._platformSdk.ads.on('sticky:close', () => {
            this._setBannerState(BANNER_STATE.HIDDEN)
        })

        try {
            this._platformSdk.ads.showSticky()
        } catch (err) {
            this._setBannerState(BANNER_STATE.FAILED)
        }
    }

    hideBanner() {
        try {
            this._platformSdk.ads.closeSticky()
        } catch (err) {
            this._setBannerState(BANNER_STATE.FAILED)
        }
    }

    checkAdBlock() {
        return new Promise((resolve) => {
            this._platformSdk.ads.isAdblockEnabled().then((res) => {
                resolve(res)
            })
        })
    }
}

export default GamePushPlatformBridge
