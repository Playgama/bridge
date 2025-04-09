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
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
const BANNER_CONTAINER_ID = 'banner-container'

class CrazyGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.CRAZY_GAMES
    }

    get platformLanguage() {
        if (this.#isUserAccountAvailable) {
            return this._platformSdk.user.systemInfo.countryCode.toLowerCase()
        }

        return super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported() {
        return this.#isUserAccountAvailable
    }

    // device
    get deviceType() {
        if (this.#isUserAccountAvailable) {
            const userDeviceType = this._platformSdk.user.systemInfo.device.type.toLowerCase()
            if ([
                DEVICE_TYPE.DESKTOP,
                DEVICE_TYPE.MOBILE,
                DEVICE_TYPE.TABLET,
            ].includes(userDeviceType)
            ) {
                return userDeviceType
            }
        }

        return super.deviceType
    }

    #currentAdvertisementIsRewarded = false

    #isUserAccountAvailable = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('CrazyGames', 'SDK', 'init').then(() => {
                    this._platformSdk = window.CrazyGames.SDK

                    this._defaultStorageType = STORAGE_TYPE.LOCAL_STORAGE
                    this._isBannerSupported = true
                    this._platformSdk.init().then(() => {
                        this.#isUserAccountAvailable = this._platformSdk.user.isUserAccountAvailable
                        const getPlayerInfoPromise = this.#getPlayer()

                        Promise
                            .all([getPlayerInfoPromise])
                            .finally(() => {
                                this._isInitialized = true
                                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            })
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (!this.#isUserAccountAvailable) {
            return Promise.reject()
        }

        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
            this._platformSdk.user.showAuthPrompt()
                .then(() => {
                    this.#getPlayer()
                        .then(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                        })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED: {
                this._platformSdk.game.loadingStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED: {
                this._platformSdk.game.loadingStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED: {
                this._platformSdk.game.gameplayStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED: {
                this._platformSdk.game.gameplayStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT: {
                this._platformSdk.game.happytime()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                if (Array.isArray(key)) {
                    const values = []
                    key.forEach((k) => {
                        let value = this._platformSdk.data.getItem(k)

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

                let value = this._platformSdk.data.getItem(key)

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

                        this._platformSdk.data.setItem(key[i], valueData)
                    }

                    resolve()
                    return
                }

                let valueData = value

                if (typeof value !== 'string') {
                    valueData = JSON.stringify(value)
                }

                this._platformSdk.data.setItem(key, valueData)
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

    // advertisement
    showBanner(options) {
        let container = document.getElementById(BANNER_CONTAINER_ID)

        if (!container) {
            container = document.createElement('div')
            container.id = BANNER_CONTAINER_ID
            container.style.position = 'absolute'
            document.body.appendChild(container)
        }

        if (options?.position === 'top') {
            container.style.top = 0
            container.style.height = '90px'
            container.style.width = '100%'
        } else if (options?.position === 'left') {
            container.style.left = 0
            container.style.top = 0
            container.style.height = '100%'
            container.style.width = '90px'
        } else if (options?.position === 'right') {
            container.style.right = 0
            container.style.top = 0
            container.style.height = '100%'
            container.style.width = '90px'
        } else {
            container.style.bottom = 0
            container.style.height = '90px'
            container.style.width = '100%'
        }

        container.style.display = 'block'

        this._platformSdk.banner.requestResponsiveBanner([BANNER_CONTAINER_ID])
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
                container.style.display = 'none'
            })
    }

    hideBanner() {
        const container = document.getElementById(BANNER_CONTAINER_ID)
        if (container) {
            container.style.display = 'none'
        }

        this._platformSdk.banner.clearAllBanners()
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial() {
        this.#currentAdvertisementIsRewarded = false
        this._platformSdk.ad.requestAd('midgame', this.#adCallbacks)
    }

    showRewarded() {
        this.#currentAdvertisementIsRewarded = true
        this._platformSdk.ad.requestAd('rewarded', this.#adCallbacks)
    }

    checkAdBlock() {
        return new Promise((resolve) => {
            this._platformSdk.ad.hasAdblock().then((res) => {
                resolve(res)
            })
        })
    }

    #adCallbacks = {
        adStarted: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        },
        adFinished: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
        },
        adError: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.FAILED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            }
        },
    }

    #getPlayer() {
        if (!this.#isUserAccountAvailable) {
            return Promise.reject()
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.user.getUser()
                .then((user) => {
                    if (!user) {
                        reject()
                        return
                    }

                    this._isPlayerAuthorized = true
                    this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

                    if (user.username) {
                        this._playerName = user.username
                    }

                    if (user.profilePictureUrl) {
                        this._playerPhotos = [user.profilePictureUrl]
                    }

                    resolve()
                })
                .catch((error) => {
                    reject(error)
                })
        })
    }
}

export default CrazyGamesPlatformBridge
