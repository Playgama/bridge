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
    addJavaScript,
    waitFor,
} from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME, STORAGE_TYPE,
    ERROR, REWARDED_STATE, INTERSTITIAL_STATE, BANNER_STATE,
} from '../constants'

const SDK_URL = '//api.ok.ru/js/fapi5.js'
const AUTH_STATE = 'AUTHORIZED'
const PERMISSION_TYPES = {
    VALUABLE_ACCESS: 'VALUABLE_ACCESS',
    PHOTO_CONTENT: 'PHOTO_CONTENT',
}

class OkPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.OK
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
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

    // social
    get isJoinCommunitySupported() {
        return true
    }

    get isInviteFriendsSupported() {
        return true
    }

    get isCreatePostSupported() {
        return true
    }

    get isRateSupported() {
        return true
    }

    get isExternalLinksAllowed() {
        return false
    }

    // clipboard
    get isClipboardSupported() {
        return false
    }

    _hasValuableAccessPermission = false

    _hasValuableAccessPermissionShowed = false

    _platformBannerOptions = {}

    #advertisementBannerPosition = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => {
                    waitFor('FAPI')
                        .then(() => {
                            this._platformSdk = window.FAPI
                            window.API_callback = (method, result, data) => this.#apiCallbacks[method](result, data)

                            const params = this._platformSdk.Util.getRequestParameters() || {}
                            if (!params.api_server || !params.apiconnection) {
                                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.OK_GAME_PARAMS_NOT_FOUND)
                            } else {
                                this._platformSdk.init(
                                    params.api_server,
                                    params.apiconnection,
                                    () => {
                                        const savedState = this._platformSdk?.saved_state
                                        this._isPlayerAuthorized = savedState ? savedState === AUTH_STATE : true
                                        if (this._isPlayerAuthorized) {
                                            this._platformSdk.Client.call(
                                                this.#fields.userProfile,
                                                this.#callbacks.userProfileCallback,
                                            )
                                        } else {
                                            this._isInitialized = true
                                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                        }
                                    },
                                    () => {
                                        this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE)
                                    },
                                )
                            }
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
            this._platformSdk.UI.showLoginSuggestion(AUTH_STATE)
        }

        return promiseDecorator.promise
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
            return this._hasValuableAccessPermission
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            return new Promise((resolve, reject) => {
                const keys = Array.isArray(key) ? key : [key]
                const params = { method: 'storage.get', keys, scope: 'CUSTOM' }
                this._platformSdk.Client.call(params, (status, data, error) => {
                    if (data) {
                        const response = data.data || { }

                        if (Array.isArray(key)) {
                            const values = []

                            keys.forEach((item) => {
                                if (response[item] === '' || response[item] === undefined) {
                                    values.push(null)
                                    return
                                }

                                let value = response[item]
                                if (tryParseJson) {
                                    try {
                                        value = JSON.parse(response[item])
                                    } catch (e) {
                                        // keep value as it is
                                    }
                                }

                                values.push(value)
                            })

                            resolve(values)
                            return
                        }

                        if (response[key] === '' || response[key] === undefined) {
                            resolve(null)
                            return
                        }

                        let value = response[key]
                        if (tryParseJson) {
                            try {
                                value = JSON.parse(response[key])
                            } catch (e) {
                                // keep value as it is
                            }
                        }

                        resolve(value)
                    } else {
                        reject(error)
                    }
                })
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            const keys = Array.isArray(key) ? key : [key]
            const values = Array.isArray(key) ? value : [value]
            const promises = []

            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]
                let v = values[i]

                if (typeof v !== 'string') {
                    v = JSON.stringify(v)
                }

                const params = { method: 'storage.set', key: k, value: v }
                const promise = new Promise((resolve, reject) => {
                    this._platformSdk.Client.call(params, (status, data) => {
                        if (data) {
                            resolve()
                        } else {
                            reject()
                        }
                    })
                })

                promises.push(promise)
            }

            return Promise.all(promises)
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            const keys = Array.isArray(key) ? key : [key]
            const promises = []

            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]

                const params = { method: 'storage.set', key: k }
                const promise = new Promise((resolve, reject) => {
                    this._platformSdk.Client.call(params, (status, data) => {
                        if (data) {
                            resolve()
                        } else {
                            reject()
                        }
                    })
                })

                promises.push(promise)
            }

            return Promise.all(promises)
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial() {
        try {
            this._platformSdk.UI.showAd()
        } catch {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
        }
    }

    showRewarded() {
        try {
            this._platformSdk.UI.loadAd()
        } catch {
            this._setRewardedState(REWARDED_STATE.FAILED)
        }
    }

    showBanner(position) {
        this.#advertisementBannerPosition = position
        this._platformSdk.invokeUIMethod('requestBannerAds')
    }

    hideBanner() {
        this._platformSdk.invokeUIMethod('hideBannerAds')
    }

    checkAdBlock() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADBLOCK_DETECT)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADBLOCK_DETECT)
            this._platformSdk.invokeUIMethod('isAdBlockEnabled')
        }

        return promiseDecorator.promise
    }

    inviteFriends(options) {
        const { text } = options || {}

        if (!options || typeof text !== 'string') {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
            if (text.length > 120) {
                this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, ERROR.INVITE_FRIENDS_MESSAGE_LENGTH_ERROR)
            } else {
                this._platformSdk.UI.showInvite(text)
            }
        }

        return promiseDecorator.promise
    }

    rate() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE)
            this._platformSdk.UI.showRatingDialog()
        }

        return promiseDecorator.promise
    }

    createPost(options) {
        if (!options || !options?.media) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST)
            this._platformSdk.UI.postMediatopic(options, options.status ?? false)
        }

        return promiseDecorator.promise
    }

    joinCommunity(options) {
        if (!options || !options?.groupId) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
            this._platformSdk.UI.joinGroup(options.groupId, options.enableMessages ?? false)
        }

        return promiseDecorator.promise
    }

    get #fields() {
        return {
            userProfile: {
                fields: 'uid,name,pic50x50,pic128x128,pic_base',
                method: 'users.getCurrentUser',
            },
            hasAppPermission: (permission) => ({
                method: 'users.hasAppPermission',
                ext_perm: permission,
            }),
        }
    }

    get #callbacks() {
        return {
            userProfileCallback: (status, data, error) => this.#onGetUserProfileCompleted(status, data, error),
            hasValueAccessCallback: (_, result, data) => this.#onHasAccessValuePermissionCompleted(result, data),
        }
    }

    get #apiCallbacks() {
        return {
            showPermissions: () => this.#onSetStatusPermissionCompleted(),
            loadAd: (result) => this.#onLoadedRewarded(result),
            showLoadedAd: (_, data) => this.#onRewardedShown(data),
            showAd: (_, data) => this.#onInterstitialShown(data),
            requestBannerAds: (result, data) => this.#onRequestedBanner(result, data),
            showBannerAds: (_, data) => this.#onShownBanner(data),
            hideBannerAds: (_, data) => this.#onHiddenBanner(data),
            setBannerFormat: (result) => this.#onSetBannerFormat(result),
            showInvite: (result) => this.#onInviteFriendsCompleted(result),
            showRatingDialog: (result, data) => this.#onGameRatingReceived(result, data),
            joinGroup: (result, data) => this.#onJoinGroupRequested(result, data),
            showLoginSuggestion: (result, data) => this.#onLoginCompleted(result, data),
            postMediatopic: (result, data) => this.#onPostCreatedCompleted(result, data),
            isAdBlockEnabled: (result, data) => this.#onIsAdBlockEnabled(result, data),
        }
    }

    #onGetUserProfileCompleted(status, data) {
        if (status === 'ok') {
            this._playerId = data.uid
            this._playerName = data.name
            this._playerPhotos = [data.pic50x50, data.pic128x128, data.pic_base]
        }

        this._isInitialized = true
        this._platformSdk.Client.call(
            this.#fields.hasAppPermission(PERMISSION_TYPES.VALUABLE_ACCESS),
            this.#callbacks.hasValueAccessCallback,
        )
    }

    #onLoginCompleted(result, data) {
        if (result === 'error') {
            this._isPlayerAuthorized = false
            this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, data)
            return
        }

        this._isPlayerAuthorized = true
        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
    }

    #onHasAccessValuePermissionCompleted(result) {
        this._hasValuableAccessPermission = !!result

        this._defaultStorageType = this._hasValuableAccessPermission
            ? STORAGE_TYPE.PLATFORM_INTERNAL
            : STORAGE_TYPE.LOCAL_STORAGE

        if (!this._hasValuableAccessPermission && !this._hasValuableAccessPermissionShowed) {
            const permissions = Object.values(PERMISSION_TYPES)
                .map((value) => `"${value}"`)
                .join(',')
            this._platformSdk.UI.showPermissions(`[${permissions}]`)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
        }
    }

    #onSetStatusPermissionCompleted() {
        this._hasValuableAccessPermissionShowed = true
        this._platformSdk.Client.call(
            this.#fields.hasAppPermission(PERMISSION_TYPES.VALUABLE_ACCESS),
            this.#callbacks.hasValueAccessCallback,
        )
    }

    #onLoadedRewarded(result) {
        if (result === 'error') {
            this._setRewardedState(REWARDED_STATE.FAILED)
        } else {
            this._setRewardedState(REWARDED_STATE.OPENED)
            this._platformSdk.UI.showLoadedAd()
        }
    }

    #onRewardedShown(data) {
        switch (data) {
            case 'complete':
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
                break
            case 'skip':
                this._setRewardedState(REWARDED_STATE.CLOSED)
                break
            case 'not_prepared':
            case 'mp4_not_supported':
            case 'app_in_fullscreen':
            default:
                this._setRewardedState(REWARDED_STATE.FAILED)
                break
        }
    }

    #onInterstitialShown(data) {
        switch (data) {
            case 'ready':
            case 'ad_prepared':
                break
            case 'ad_shown':
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                break
            case 'no_ads':
            case 'call_limit':
            case 'in_use':
            case 'app_in_fullscreen':
            default:
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                break
        }
    }

    #onRequestedBanner(result, data) {
        if (result === 'error') {
            this._setBannerState(BANNER_STATE.FAILED)
            return
        }

        switch (data) {
            case 'ad_loaded':
                this._platformSdk.invokeUIMethod('showBannerAds', this.#advertisementBannerPosition)
                break
            case 'banner_shown':
            case 'ad_shown':
                this._setBannerState(BANNER_STATE.SHOWN)
                break
            case 'hidden_by_user':
                this._setBannerState(BANNER_STATE.HIDDEN)
                break
            default:
                break
        }
    }

    #onHiddenBanner(data) {
        if (!data) {
            this._setBannerState(BANNER_STATE.FAILED)
        } else {
            this._setBannerState(BANNER_STATE.HIDDEN)
        }
    }

    #onShownBanner(data) {
        if (!data) {
            this._setBannerState(BANNER_STATE.FAILED)
        }
    }

    #onSetBannerFormat(result) {
        if (result === 'error') {
            this._setBannerState(BANNER_STATE.FAILED)
        } else {
            this.showBanner(this._platformBannerOptions)
        }
    }

    #onInviteFriendsCompleted(result) {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        }
    }

    #onGameRatingReceived(result, data) {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.RATE, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.RATE)
        }
    }

    #onJoinGroupRequested(result, data) {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        }
    }

    #onPostCreatedCompleted(result, data) {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.CREATE_POST, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)
        }
    }

    #onIsAdBlockEnabled(result, data) {
        if (result === 'ok') {
            this._resolvePromiseDecorator(ACTION_NAME.ADBLOCK_DETECT, data === 'true')
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.ADBLOCK_DETECT)
        }
    }
}

export default OkPlatformBridge
