/*
 * This file is part of Playgama Bridge.
 *
 * Playgama Bridge is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Playgama Bridge is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Playgama Bridge. If not, see <https://www.gnu.org/licenses/>.
 */

import PlatformBridgeBase from './PlatformBridgeBase'
import {
    PLATFORM_ID,
    MODULE_NAME,
    ACTION_NAME,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    ERROR,
} from '../constants'

const ADVERTISEMENT_TYPE = {
    INTERSTITIAL: 'interstitial',
    REWARD: 'reward',
    BANNER: 'banner',
}

class QaToolPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.QA_TOOL
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this._isInitialized = true
            this._isBannerSupported = true
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)

            window.parent.postMessage({
                type: 'liveness',
                action: 'ping',
                version: PLUGIN_VERSION,
            }, '*')
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        window.parent.postMessage({
            type: MODULE_NAME.PLAYER,
            action: ACTION_NAME.AUTHORIZE_PLAYER,
        }, '*')
        return Promise.resolve()
    }

    // platform
    sendMessage(message) {
        const actions = [
            PLATFORM_MESSAGE.GAME_READY,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
            PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
            PLATFORM_MESSAGE.GAMEPLAY_STARTED,
            PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
            PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT,
            PLATFORM_MESSAGE.GAME_OVER,
        ]

        if (actions.includes(message)) {
            window.parent.postMessage({
                type: 'platform_message',
                action: message,
            }, '*')
            return Promise.resolve()
        }

        return super.sendMessage(message)
    }

    getServerTime() {
        window.parent.postMessage({
            type: MODULE_NAME.PLATFORM,
            action: 'get_server_time',
        }, '*')
        return super.getServerTime()
    }

    // storage
    isStorageSupported(storageType) {
        window.parent.postMessage({
            type: MODULE_NAME.STORAGE,
            action: 'is_storage_supported',
        }, '*')

        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                return this._localStorage !== null
            }
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                return false
            }
            default: {
                return false
            }
        }
    }

    isStorageAvailable(storageType) {
        window.parent.postMessage({
            type: MODULE_NAME.STORAGE,
            action: 'is_storage_available',
        }, '*')

        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                return this._localStorage !== null
            }
            case STORAGE_TYPE.PLATFORM_INTERNAL: {
                return false
            }
            default: {
                return false
            }
        }
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        window.parent.postMessage({
            type: MODULE_NAME.STORAGE,
            action: 'get_data_from_storage',
        }, '*')

        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        const values = []

                        for (let i = 0; i < key.length; i++) {
                            values.push(this._getDataFromLocalStorage(key[i], tryParseJson))
                        }

                        return Promise.resolve(values)
                    }

                    const value = this._getDataFromLocalStorage(key, tryParseJson)
                    return Promise.resolve(value)
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    setDataToStorage(key, value, storageType) {
        window.parent.postMessage({
            type: MODULE_NAME.STORAGE,
            action: 'set_data_to_storage',
        }, '*')

        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            this._setDataToLocalStorage(key[i], value[i])
                        }
                        return Promise.resolve()
                    }

                    this._setDataToLocalStorage(key, value)
                    return Promise.resolve()
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    deleteDataFromStorage(key, storageType) {
        window.parent.postMessage({
            type: MODULE_NAME.STORAGE,
            action: 'delete_data_from_storage',
        }, '*')

        switch (storageType) {
            case STORAGE_TYPE.LOCAL_STORAGE: {
                if (this._localStorage) {
                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            this._deleteDataFromLocalStorage(key[i])
                        }
                        return Promise.resolve()
                    }

                    this._deleteDataFromLocalStorage(key)
                    return Promise.resolve()
                }
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
            default: {
                return Promise.reject(ERROR.STORAGE_NOT_SUPPORTED)
            }
        }
    }

    // advertisement
    showInterstitial() {
        const showInterstitialHandler = ({ data }) => {
            if (data?.type !== MODULE_NAME.ADVERTISEMENT) {
                return
            }

            switch (data.payload.status) {
                case 'start':
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case 'show':
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case 'close':
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    window.removeEventListener('message', showInterstitialHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showInterstitialHandler)
        window.parent.postMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.INTERSTITIAL,
        }, '*')
    }

    showRewarded() {
        const showRewardedHandler = ({ data }) => {
            if (data?.type !== MODULE_NAME.ADVERTISEMENT) {
                return
            }

            switch (data.payload.status) {
                case 'show':
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    break
                case 'rewarded':
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    break
                case 'close':
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    window.removeEventListener('message', showRewardedHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showRewardedHandler)
        window.parent.postMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            action: ADVERTISEMENT_TYPE.REWARD,
        }, '*')
    }

    showBanner() {
        this._setBannerState(BANNER_STATE.SHOWN)
        window.parent.postMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            adType: ADVERTISEMENT_TYPE.BANNER,
            action: BANNER_STATE.SHOWN,
        }, '*')
    }

    hideBanner() {
        this._setBannerState(BANNER_STATE.HIDDEN)
        window.parent.postMessage({
            type: MODULE_NAME.ADVERTISEMENT,
            adType: ADVERTISEMENT_TYPE.BANNER,
            action: BANNER_STATE.HIDDEN,
        }, '*')
    }

    checkAdBlock() {
        window.parent.postMessage({
            type: 'check_adblock',
            action: ACTION_NAME.ADBLOCK_DETECT,
        }, '*')
        return new Promise((resolve) => {
            resolve(false)
        })
    }

    // social
    inviteFriends() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.INVITE_FRIENDS,
        }, '*')
        // return Promise.reject()
    }

    joinCommunity() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.JOIN_COMMUNITY,
        }, '*')
    }

    share() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.SHARE,
        }, '*')
    }

    createPost() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.CREATE_POST,
        }, '*')
    }

    addToHomeScreen() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.ADD_TO_HOME_SCREEN,
        }, '*')
    }

    addToFavorites() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.ADD_TO_FAVORITES,
        }, '*')
    }

    rate() {
        window.parent.postMessage({
            type: MODULE_NAME.SOCIAL,
            action: ACTION_NAME.RATE,
        }, '*')
    }

    // config
    getRemoteConfig() {
        window.parent.postMessage({ type: MODULE_NAME.REMOTE_CONFIG }, '*')
        return Promise.reject()
    }

    // clipboard
    clipboardWrite(text) {
        window.parent.postMessage({ type: MODULE_NAME.CLIPBOARD }, '*')
        return super.clipboardWrite(text)
    }
}

export default QaToolPlatformBridge
