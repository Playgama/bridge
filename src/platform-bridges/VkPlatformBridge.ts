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
import { addJavaScript, waitFor } from '../utils'
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import { DEVICE_TYPE, type DeviceType } from '../modules/device/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../modules/advertisement/constants'
import type { AnyRecord } from '../utils'

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js'

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
                                    this._setPlatformStorageAvailable(true)
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

    // storage — VK stores values per key.
    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        const sdk = this._platformSdk as VkBridge
        const valuesResult = await sdk.send('VKWebAppStorageGet', { keys }) as unknown as VkStorageGetResponse
        const data: Record<string, unknown> = {}
        valuesResult.keys.forEach((entry) => {
            if (entry.value !== '') {
                data[entry.key] = entry.value
            }
        })
        return data
    }

    setDataToStorage(data: Record<string, unknown>): Promise<void> {
        const sdk = this._platformSdk as VkBridge
        return Promise.all(
            Object.keys(data).map((key) => sdk.send('VKWebAppStorageSet', {
                key,
                value: data[key] as string,
            })),
        ).then(() => undefined)
    }

    deleteDataFromStorage(keys: string[]): Promise<void> {
        const sdk = this._platformSdk as VkBridge
        return Promise.all(
            keys.map((key) => sdk.send('VKWebAppStorageSet', {
                key,
                value: '',
            })),
        ).then(() => undefined)
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
