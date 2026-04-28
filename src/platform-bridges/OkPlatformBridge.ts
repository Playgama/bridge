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
    type PlatformId,
    type StorageType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = '//api.ok.ru/js/fapi5.js'
const AUTH_STATE = 'AUTHORIZED'
const PERMISSION_TYPES = {
    VALUABLE_ACCESS: 'VALUABLE_ACCESS',
    PHOTO_CONTENT: 'PHOTO_CONTENT',
}

type OkClientCallback = (status: string, data: AnyRecord, error?: unknown) => void

interface OkSdk {
    Util: {
        getRequestParameters(): AnyRecord | null
    }
    init(apiServer: string, apiConnection: string, onSuccess: () => void, onError: () => void): void
    Client: {
        call(params: AnyRecord, callback: OkClientCallback): void
    }
    UI: {
        showLoginSuggestion(state: string): void
        showAd(): void
        loadAd(): void
        showLoadedAd(): void
        showInvite(text: string): void
        showRatingDialog(): void
        joinGroup(groupId: string | number, enableMessages: boolean): void
        showPermissions(permissions: string): void
        postMediatopic(options: AnyRecord, status: boolean): void
    }
    invokeUIMethod(method: string, ...args: unknown[]): void
    saved_state?: string
}

declare global {
    interface Window {
        FAPI?: OkSdk
        // eslint-disable-next-line @typescript-eslint/naming-convention
        API_callback?: (method: string, result: string, data: unknown) => void
    }
}

class OkPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.OK
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // advertisement
    get isBannerSupported(): boolean {
        return true
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isJoinCommunitySupported(): boolean {
        return true
    }

    get isInviteFriendsSupported(): boolean {
        return true
    }

    get isCreatePostSupported(): boolean {
        return true
    }

    get isRateSupported(): boolean {
        return true
    }

    get isExternalLinksAllowed(): boolean {
        return false
    }

    // clipboard
    get isClipboardSupported(): boolean {
        return false
    }

    protected _hasValuableAccessPermission = false

    protected _hasValuableAccessPermissionShowed = false

    protected _platformBannerOptions: AnyRecord = {}

    #advertisementBannerPosition: unknown = null

    initialize(): Promise<unknown> {
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
                            this._platformSdk = window.FAPI as OkSdk
                            window.API_callback = (method, result, data) => {
                                const callbacks = this.#apiCallbacks as Record<string, (result: string, data: unknown) => void>
                                callbacks[method]?.(result, data)
                            }

                            const sdk = this._platformSdk as OkSdk
                            const params = sdk.Util.getRequestParameters() || {}
                            if (!params.api_server || !params.apiconnection) {
                                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
                            } else {
                                sdk.init(
                                    params.api_server as string,
                                    params.apiconnection as string,
                                    () => {
                                        const savedState = (this._platformSdk as OkSdk)?.saved_state
                                        this._isPlayerAuthorized = savedState ? savedState === AUTH_STATE : true
                                        if (this._isPlayerAuthorized) {
                                            (this._platformSdk as OkSdk).Client.call(
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
    authorizePlayer(): Promise<unknown> {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER);
            (this._platformSdk as OkSdk).UI.showLoginSuggestion(AUTH_STATE)
        }

        return promiseDecorator.promise
    }

    // storage
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            return new Promise((resolve, reject) => {
                const keys = Array.isArray(key) ? key : [key]
                const params = { method: 'storage.get', keys, scope: 'CUSTOM' };
                (this._platformSdk as OkSdk).Client.call(params, (_status, data, error) => {
                    if (data) {
                        const response = (data.data as AnyRecord) || { }

                        if (Array.isArray(key)) {
                            const values: unknown[] = []

                            keys.forEach((item) => {
                                if (response[item] === '' || response[item] === undefined) {
                                    values.push(null)
                                    return
                                }

                                let value: unknown = response[item]
                                if (tryParseJson) {
                                    try {
                                        value = JSON.parse(response[item] as string)
                                    } catch (e) {
                                        // keep value as it is
                                    }
                                }

                                values.push(value)
                            })

                            resolve(values)
                            return
                        }

                        if (response[key as string] === '' || response[key as string] === undefined) {
                            resolve(null)
                            return
                        }

                        let value: unknown = response[key as string]
                        if (tryParseJson) {
                            try {
                                value = JSON.parse(response[key as string] as string)
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

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            const keys = Array.isArray(key) ? key : [key]
            const values = Array.isArray(key) ? (value as unknown[]) : [value]
            const promises: Array<Promise<void>> = []

            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]
                let v = values[i]

                if (typeof v !== 'string') {
                    v = JSON.stringify(v)
                }

                const params = { method: 'storage.set', key: k, value: v }
                const promise = new Promise<void>((resolve, reject) => {
                    (this._platformSdk as OkSdk).Client.call(params, (_status, data) => {
                        if (data) {
                            resolve()
                        } else {
                            reject()
                        }
                    })
                })

                promises.push(promise)
            }

            return Promise.all(promises).then(() => undefined)
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._hasValuableAccessPermission) {
                return Promise.reject(ERROR.STORAGE_NOT_AVAILABLE)
            }

            const keys = Array.isArray(key) ? key : [key]
            const promises: Array<Promise<void>> = []

            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]

                const params = { method: 'storage.set', key: k }
                const promise = new Promise<void>((resolve, reject) => {
                    (this._platformSdk as OkSdk).Client.call(params, (_status, data) => {
                        if (data) {
                            resolve()
                        } else {
                            reject()
                        }
                    })
                })

                promises.push(promise)
            }

            return Promise.all(promises).then(() => undefined)
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial(): void {
        try {
            (this._platformSdk as OkSdk).UI.showAd()
        } catch {
            this._showAdFailurePopup(false)
        }
    }

    showRewarded(): void {
        try {
            (this._platformSdk as OkSdk).UI.loadAd()
        } catch {
            this._showAdFailurePopup(true)
        }
    }

    showBanner(position?: unknown): void {
        this.#advertisementBannerPosition = position;
        (this._platformSdk as OkSdk).invokeUIMethod('requestBannerAds')
    }

    hideBanner(): void {
        (this._platformSdk as OkSdk).invokeUIMethod('hideBannerAds')
    }

    checkAdBlock(): Promise<boolean> {
        let promiseDecorator = this._getPromiseDecorator<boolean>(ACTION_NAME.ADBLOCK_DETECT)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator<boolean>(ACTION_NAME.ADBLOCK_DETECT);
            (this._platformSdk as OkSdk).invokeUIMethod('isAdBlockEnabled')
        }

        return promiseDecorator.promise
    }

    inviteFriends(options?: { text?: string }): Promise<unknown> {
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
                (this._platformSdk as OkSdk).UI.showInvite(text)
            }
        }

        return promiseDecorator.promise
    }

    rate(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE);
            (this._platformSdk as OkSdk).UI.showRatingDialog()
        }

        return promiseDecorator.promise
    }

    createPost(options?: AnyRecord & { media?: unknown; status?: boolean }): Promise<unknown> {
        if (!options || !options?.media) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CREATE_POST)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CREATE_POST);
            (this._platformSdk as OkSdk).UI.postMediatopic(options, options.status ?? false)
        }

        return promiseDecorator.promise
    }

    joinCommunity(options?: { groupId?: string | number; enableMessages?: boolean }): Promise<unknown> {
        if (!options || !options?.groupId) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY);
            (this._platformSdk as OkSdk).UI.joinGroup(options.groupId, options.enableMessages ?? false)
        }

        return promiseDecorator.promise
    }

    get #fields() {
        return {
            userProfile: {
                fields: 'uid,name,pic50x50,pic128x128,pic_base',
                method: 'users.getCurrentUser',
            },
            hasAppPermission: (permission: string) => ({
                method: 'users.hasAppPermission',
                ext_perm: permission,
            }),
        }
    }

    get #callbacks() {
        return {
            userProfileCallback: (status: string, data: AnyRecord, error?: unknown) => this.#onGetUserProfileCompleted(status, data, error),
            hasValueAccessCallback: (_: string, result: unknown, data: unknown) => this.#onHasAccessValuePermissionCompleted(result, data),
        }
    }

    get #apiCallbacks(): Record<string, (result: string, data: unknown) => void> {
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

    #onGetUserProfileCompleted(status: string, data: AnyRecord, _error?: unknown): void {
        if (status === 'ok') {
            this._playerId = data.uid as string
            this._playerName = data.name as string
            this._playerPhotos = [data.pic50x50 as string, data.pic128x128 as string, data.pic_base as string]
        }

        this._isInitialized = true;
        (this._platformSdk as OkSdk).Client.call(
            this.#fields.hasAppPermission(PERMISSION_TYPES.VALUABLE_ACCESS),
            this.#callbacks.hasValueAccessCallback,
        )
    }

    #onLoginCompleted(result: string, data: unknown): void {
        if (result === 'error') {
            this._isPlayerAuthorized = false
            this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, data)
            return
        }

        this._isPlayerAuthorized = true
        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
    }

    #onHasAccessValuePermissionCompleted(result: unknown, _data: unknown): void {
        this._hasValuableAccessPermission = !!result

        this._defaultStorageType = this._hasValuableAccessPermission
            ? STORAGE_TYPE.PLATFORM_INTERNAL
            : STORAGE_TYPE.LOCAL_STORAGE

        if (!this._hasValuableAccessPermission && !this._hasValuableAccessPermissionShowed) {
            const permissions = Object.values(PERMISSION_TYPES)
                .map((value) => `"${value}"`)
                .join(',');
            (this._platformSdk as OkSdk).UI.showPermissions(`[${permissions}]`)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
        }
    }

    #onSetStatusPermissionCompleted(): void {
        this._hasValuableAccessPermissionShowed = true;
        (this._platformSdk as OkSdk).Client.call(
            this.#fields.hasAppPermission(PERMISSION_TYPES.VALUABLE_ACCESS),
            this.#callbacks.hasValueAccessCallback,
        )
    }

    #onLoadedRewarded(result: string): void {
        if (result === 'error') {
            this._showAdFailurePopup(true)
        } else {
            this._setRewardedState(REWARDED_STATE.OPENED);
            (this._platformSdk as OkSdk).UI.showLoadedAd()
        }
    }

    #onRewardedShown(data: unknown): void {
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
                this._showAdFailurePopup(true)
                break
        }
    }

    #onInterstitialShown(data: unknown): void {
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
                this._showAdFailurePopup(false)
                break
        }
    }

    #onRequestedBanner(result: string, data: unknown): void {
        if (result === 'error') {
            this._setBannerState(BANNER_STATE.FAILED)
            return
        }

        switch (data) {
            case 'ad_loaded':
                (this._platformSdk as OkSdk).invokeUIMethod('showBannerAds', this.#advertisementBannerPosition)
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

    #onHiddenBanner(data: unknown): void {
        if (!data) {
            this._setBannerState(BANNER_STATE.FAILED)
        } else {
            this._setBannerState(BANNER_STATE.HIDDEN)
        }
    }

    #onShownBanner(data: unknown): void {
        if (!data) {
            this._setBannerState(BANNER_STATE.FAILED)
        }
    }

    #onSetBannerFormat(result: string): void {
        if (result === 'error') {
            this._setBannerState(BANNER_STATE.FAILED)
        } else {
            this.showBanner(this._platformBannerOptions)
        }
    }

    #onInviteFriendsCompleted(result: string): void {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        }
    }

    #onGameRatingReceived(result: string, data: unknown): void {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.RATE, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.RATE)
        }
    }

    #onJoinGroupRequested(result: string, data: unknown): void {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        }
    }

    #onPostCreatedCompleted(result: string, data: unknown): void {
        if (result === 'error') {
            this._rejectPromiseDecorator(ACTION_NAME.CREATE_POST, data)
        } else {
            this._resolvePromiseDecorator(ACTION_NAME.CREATE_POST)
        }
    }

    #onIsAdBlockEnabled(result: string, data: unknown): void {
        if (result === 'ok') {
            this._resolvePromiseDecorator(ACTION_NAME.ADBLOCK_DETECT, data === 'true')
        } else {
            this._rejectPromiseDecorator(ACTION_NAME.ADBLOCK_DETECT)
        }
    }
}

export default OkPlatformBridge
