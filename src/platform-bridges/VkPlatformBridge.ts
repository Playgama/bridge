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
    DEVICE_TYPE,
    BANNER_STATE,
    type PlatformId,
    type StorageType,
    type DeviceType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js'

interface VkBridgeError {
    error_data?: {
        error_reason?: unknown
    }
}

interface VkStorageGetResponse {
    keys: Array<{ key: string; value: string }>
}

interface VkBridge {
    send(method: string, params?: AnyRecord): Promise<AnyRecord>
}

declare global {
    interface Window {
        vkBridge?: VkBridge
    }
}

class VkPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.VK
    }

    get platformLanguage(): string {
        const url = new URL(window.location.href)
        if (url.searchParams.has('language')) {
            const languageString = url.searchParams.get('language')
            let languageCode = 0
            try { languageCode = parseInt(languageString as string, 10) } catch (e) {
                languageCode = 0
            }

            switch (languageCode) {
                case 0: {
                    return 'ru'
                }
                case 1: {
                    return 'uk'
                }
                case 2: {
                    return 'be'
                }
                case 3: {
                    return 'en'
                }
                default: {
                    return 'ru'
                }
            }
        }

        return super.platformLanguage
    }

    get platformPayload(): string | null {
        const url = new URL(window.location.href)
        if (url.searchParams.has('hash')) {
            return url.searchParams.get('hash')
        }

        return super.platformPayload
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // device
    get deviceType(): DeviceType {
        switch (this.#platform) {
            case 'html5_ios':
            case 'html5_android':
            case 'html5_mobile': {
                return DEVICE_TYPE.MOBILE
            }
            case 'web': {
                return DEVICE_TYPE.DESKTOP
            }
            default: {
                return super.deviceType
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    get isPlayerAuthorized(): boolean {
        return true
    }

    // social
    get isInviteFriendsSupported(): boolean {
        return true
    }

    get isJoinCommunitySupported(): boolean {
        return true
    }

    get isShareSupported(): boolean {
        return true
    }

    get isAddToHomeScreenSupported(): boolean {
        return this.#platform === 'html5_android'
    }

    get isAddToFavoritesSupported(): boolean {
        return true
    }

    protected _isBannerSupported = true

    #platform: string | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const url = new URL(window.location.href)
            if (url.searchParams.has('platform')) {
                this.#platform = url.searchParams.get('platform')
            }

            addJavaScript(SDK_URL).then(() => {
                waitFor('vkBridge').then(() => {
                    this._platformSdk = window.vkBridge as VkBridge;
                    (this._platformSdk as VkBridge)
                        .send('VKWebAppInit')
                        .then(() => {
                            (this._platformSdk as VkBridge).send('VKWebAppGetUserInfo')
                                .then((data) => {
                                    if (data) {
                                        this._playerId = data.id as string
                                        this._playerName = `${data.first_name} ${data.last_name}`

                                        if (data.photo_100) {
                                            this._playerPhotos.push(data.photo_100 as string)
                                        }

                                        if (data.photo_200) {
                                            this._playerPhotos.push(data.photo_200 as string)
                                        }

                                        if (data.photo_max_orig) {
                                            this._playerPhotos.push(data.photo_max_orig as string)
                                        }
                                    }
                                })
                                .finally(() => {
                                    this._isInitialized = true
                                    this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                })
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer(): Promise<unknown> {
        return Promise.resolve()
    }

    // storage
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const keys = Array.isArray(key) ? key : [key];
                (this._platformSdk as VkBridge)
                    .send('VKWebAppStorageGet', { keys })
                    .then((data) => {
                        const response = data as unknown as VkStorageGetResponse
                        if (Array.isArray(key)) {
                            const values: unknown[] = []

                            keys.forEach((item) => {
                                const valueIndex = response.keys.findIndex((d) => d.key === item)
                                if (valueIndex < 0) {
                                    values.push(null)
                                    return
                                }

                                if (response.keys[valueIndex].value === '') {
                                    values.push(null)
                                    return
                                }

                                let { value } = response.keys[valueIndex]
                                if (tryParseJson) {
                                    try {
                                        value = JSON.parse(response.keys[valueIndex].value)
                                    } catch (e) {
                                        // keep value as it is
                                    }
                                }

                                values.push(value)
                            })

                            resolve(values)
                            return
                        }

                        if (response.keys[0].value === '') {
                            resolve(null)
                            return
                        }

                        let { value } = response.keys[0]
                        if (tryParseJson) {
                            try {
                                value = JSON.parse(response.keys[0].value)
                            } catch (e) {
                                // keep value as it is
                            }
                        }

                        resolve(value)
                    })
                    .catch((error: VkBridgeError) => {
                        if (error && error.error_data && error.error_data.error_reason) {
                            reject(error.error_data.error_reason)
                        } else {
                            reject()
                        }
                    })
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const promises: Array<Promise<unknown>> = []
                const values = value as unknown[]

                for (let i = 0; i < key.length; i++) {
                    const data: { key: string; value: unknown } = { key: key[i], value: values[i] }

                    if (typeof values[i] !== 'string') {
                        data.value = JSON.stringify(values[i])
                    }

                    promises.push((this._platformSdk as VkBridge).send('VKWebAppStorageSet', data))
                }

                return Promise.all(promises).then(() => undefined)
            }
            const data: { key: string; value: unknown } = { key, value }

            if (typeof value !== 'string') {
                data.value = JSON.stringify(value)
            }

            return new Promise<void>((resolve, reject) => {
                (this._platformSdk as VkBridge)
                    .send('VKWebAppStorageSet', data)
                    .then(() => {
                        resolve()
                    })
                    .catch((error: VkBridgeError) => {
                        if (error && error.error_data && error.error_data.error_reason) {
                            reject(error.error_data.error_reason)
                        } else {
                            reject()
                        }
                    })
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                const promises: Array<Promise<unknown>> = []

                for (let i = 0; i < key.length; i++) {
                    promises.push(this.setDataToStorage(key[i], '', storageType))
                }

                return Promise.all(promises).then(() => undefined)
            }
            return this.setDataToStorage(key, '', storageType)
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showBanner(position?: unknown): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppShowBannerAd', { banner_location: position })
            .then((data) => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.SHOWN)
                } else {
                    this._setBannerState(BANNER_STATE.FAILED)
                }
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppHideBannerAd')
            .then((data) => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.HIDDEN)
                }
            })
    }

    showInterstitial(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' })
            .then((data) => {
                if (data.result) {
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                }
            })
            .finally(() => {
                (this._platformSdk as VkBridge)
                    .send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
                    .then((data) => {
                        if (data.result) {
                            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                        } else {
                            this._showAdFailurePopup(false)
                        }
                    })
                    .catch(() => {
                        this._showAdFailurePopup(false)
                    })
            })
    }

    showRewarded(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppCheckNativeAds', { ad_format: 'reward', use_waterfall: true })
            .then((data) => {
                if (data.result) {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                }
            })
            .finally(() => {
                (this._platformSdk as VkBridge)
                    .send('VKWebAppShowNativeAds', { ad_format: 'reward', use_waterfall: true })
                    .then((data) => {
                        if (data.result) {
                            this._setRewardedState(REWARDED_STATE.REWARDED)
                            this._setRewardedState(REWARDED_STATE.CLOSED)
                        } else {
                            this._showAdFailurePopup(true)
                        }
                    })
                    .catch(() => {
                        this._showAdFailurePopup(true)
                    })
            })
    }

    // social
    inviteFriends(): Promise<unknown> {
        return this.#sendRequestToVKBridge(ACTION_NAME.INVITE_FRIENDS, 'VKWebAppShowInviteBox', { }, 'success')
    }

    joinCommunity(options?: { groupId?: string | number }): Promise<unknown> {
        if (!options || !options.groupId) {
            return Promise.reject()
        }

        let { groupId } = options

        if (typeof groupId === 'string') {
            groupId = parseInt(groupId, 10)
            if (Number.isNaN(groupId)) {
                return Promise.reject()
            }
        }

        return this.#sendRequestToVKBridge(ACTION_NAME.JOIN_COMMUNITY, 'VKWebAppJoinGroup', { group_id: groupId })
            .then(() => {
                window.open(`https://vk.com/public${groupId}`)
            })
    }

    share(options?: { link?: string }): Promise<unknown> {
        const parameters: AnyRecord = { }
        if (options && options.link) {
            parameters.link = options.link
        }

        return this.#sendRequestToVKBridge(ACTION_NAME.SHARE, 'VKWebAppShare', parameters, 'type')
    }

    addToHomeScreen(): Promise<unknown> {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        return this.#sendRequestToVKBridge(ACTION_NAME.ADD_TO_HOME_SCREEN, 'VKWebAppAddToHomeScreen')
    }

    addToFavorites(): Promise<unknown> {
        return this.#sendRequestToVKBridge(ACTION_NAME.ADD_TO_FAVORITES, 'VKWebAppAddToFavorites')
    }

    // clipboard
    clipboardWrite(text: string): Promise<void> {
        return this.#sendRequestToVKBridge(ACTION_NAME.CLIPBOARD_WRITE, 'VKWebAppCopyText', { text })
            .then(() => undefined)
    }

    #sendRequestToVKBridge(actionName: string, vkMethodName: string, parameters: AnyRecord = { }, responseSuccessKey = 'result'): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(actionName)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(actionName);
            (this._platformSdk as VkBridge)
                .send(vkMethodName, parameters)
                .then((data) => {
                    if (data[responseSuccessKey]) {
                        this._resolvePromiseDecorator(actionName)
                        return
                    }

                    this._rejectPromiseDecorator(actionName)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(actionName, error)
                })
        }

        return promiseDecorator.promise
    }
}

export default VkPlatformBridge
