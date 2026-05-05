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
import { getGuestUser, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    REWARDED_STATE,
    INTERSTITIAL_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    DEVICE_OS,
    PLATFORM_MESSAGE,
    VISIBILITY_STATE,
    ERROR,
    type PlatformId,
    type CloudStorageMode,
    type DeviceType,
    type DeviceOs,
} from '../constants'
import type { SafeArea } from '../types/common'

interface TikTokSystemInfo {
    language: string
    platform: string
    [key: string]: unknown
}

interface TikTokRect {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
}

interface TikTokSuccessFailCallbacks<T = unknown> {
    success?: (result: T) => void
    fail?: (error: unknown) => void
}

interface TikTokAd {
    onClose(callback: (res?: { isEnded?: boolean }) => void): void
    onError(callback: (error: unknown) => void): void
    show(): Promise<unknown>
}

interface TikTokSdk {
    canIUse(name: string): boolean
    init(options: { clientKey: string }): void
    getSystemInfoSync(): TikTokSystemInfo
    getMenuButtonBoundingClientRect(): TikTokRect
    onShow(callback: () => void): void
    onHide(callback: () => void): void
    login(callbacks: TikTokSuccessFailCallbacks): void
    setLoadingProgress(options: { progress: number }): void
    getStorage(options: { key: string } & TikTokSuccessFailCallbacks<{ data: unknown }>): void
    getStorageInfoSync?(): { keys?: string[] }
    setStorage(options: { key: string, data: unknown } & TikTokSuccessFailCallbacks): void
    removeStorage(options: { key: string } & TikTokSuccessFailCallbacks): void
    createInterstitialAd(options: { adUnitId?: unknown }): TikTokAd
    createRewardedVideoAd(options: { adUnitId?: unknown }): TikTokAd
    addShortcut(callbacks: TikTokSuccessFailCallbacks): void
    getShortcutMissionReward(callbacks: TikTokSuccessFailCallbacks<{ canReceiveReward?: boolean }>): void
    startEntranceMission(callbacks: TikTokSuccessFailCallbacks): void
    getEntranceMissionReward(callbacks: TikTokSuccessFailCallbacks<{ canReceiveReward?: boolean }>): void
}

declare global {
    interface Window {
        TTMinis?: { game: TikTokSdk }
    }
}

class TikTokPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.TIKTOK
    }

    get platformLanguage(): string {
        if (this.#systemInfo) {
            return this.#systemInfo.language
        }

        return super.platformLanguage
    }

    get isPlayerAuthorizationSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('login')) {
            return true
        }

        return false
    }

    get isInterstitialSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('createInterstitialAd')) {
            return true
        }

        return false
    }

    get isRewardedSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('createRewardedVideoAd')) {
            return true
        }

        return false
    }

    get isAddToHomeScreenSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('addShortcut')) {
            return true
        }

        return false
    }

    get isAddToHomeScreenRewardSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('getShortcutMissionReward')) {
            return true
        }

        return false
    }

    get isAddToFavoritesSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('startEntranceMission')) {
            return true
        }

        return false
    }

    get isAddToFavoritesRewardSupported(): boolean {
        const sdk = this._platformSdk as TikTokSdk | null
        if (sdk && sdk.canIUse('getEntranceMissionReward')) {
            return true
        }

        return false
    }

    get safeArea(): SafeArea | null {
        if (this.#menuButtonRect) {
            return {
                top: this.#menuButtonRect.bottom,
                bottom: 0,
                left: 0,
                right: 0,
            }
        }

        return null
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady(): Promise<void> {
        return Promise.resolve()
    }

    get deviceType(): DeviceType {
        if (this.#systemInfo) {
            const { platform } = this.#systemInfo
            if (platform === 'ios' || platform === 'android') {
                return DEVICE_TYPE.MOBILE
            }
        }

        return super.deviceType
    }

    get deviceOs(): DeviceOs {
        if (this.#systemInfo) {
            const { platform } = this.#systemInfo

            if (platform === 'android') {
                return DEVICE_OS.ANDROID
            }
            if (platform === 'ios') {
                return DEVICE_OS.IOS
            }
        }

        return super.deviceOs
    }

    get isClipboardSupported(): boolean {
        return false
    }

    #systemInfo: TikTokSystemInfo | null = null

    #menuButtonRect: TikTokRect | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('TTMinis').then(() => {
                this._platformSdk = window.TTMinis!.game
                const sdk = this._platformSdk as TikTokSdk

                if (this._options && this._options.clientKey) {
                    sdk.init({ clientKey: this._options.clientKey as string })
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
                    return
                }

                if (sdk.canIUse('getStorage')) {
                    this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                }

                if (sdk.canIUse('getSystemInfoSync')) {
                    this.#systemInfo = sdk.getSystemInfoSync()
                }

                if (sdk.canIUse('getMenuButtonBoundingClientRect')) {
                    this.#menuButtonRect = sdk.getMenuButtonBoundingClientRect()
                }

                if (sdk.canIUse('onShow')) {
                    sdk.onShow(() => {
                        this._setVisibilityState(VISIBILITY_STATE.VISIBLE)
                    })
                }

                if (sdk.canIUse('onHide')) {
                    sdk.onHide(() => {
                        this._setVisibilityState(VISIBILITY_STATE.HIDDEN)
                    })
                }

                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            })
        }

        return promiseDecorator.promise
    }

    sendMessage(message?: unknown, _options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                const sdk = this._platformSdk as TikTokSdk
                if (sdk.canIUse('setLoadingProgress')) {
                    sdk.setLoadingProgress({ progress: 1 })
                }
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    authorizePlayer(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER);
            (this._platformSdk as TikTokSdk).login({
                success: () => {
                    const guestUser = getGuestUser()
                    this._playerId = guestUser.id
                    this._playerName = guestUser.name
                    this._isPlayerAuthorized = true
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    async loadCloudSnapshot(): Promise<Record<string, unknown>> {
        const sdk = this._platformSdk as TikTokSdk
        let keys: string[] = []
        if (sdk.canIUse('getStorageInfoSync') && sdk.getStorageInfoSync) {
            const info = sdk.getStorageInfoSync()
            keys = info && info.keys ? info.keys : []
        }

        if (keys.length === 0) {
            return {}
        }

        const values = await Promise.all(keys.map((k) => this.#getStorageItemRaw(k)))
        const snapshot: Record<string, unknown> = {}
        keys.forEach((k, i) => {
            if (values[i] !== undefined && values[i] !== null) {
                snapshot[k] = values[i]
            }
        })
        return snapshot
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>, changedKeys: string[]): Promise<void> {
        return Promise.all(changedKeys.map((k) => this.#setStorageItem(k, snapshot[k]))).then(() => undefined)
    }

    deleteCloudKeys(_snapshot: Record<string, unknown>, deletedKeys: string[]): Promise<void> {
        return Promise.all(deletedKeys.map((k) => this.#removeStorageItem(k))).then(() => undefined)
    }

    showInterstitial(placement?: unknown): void {
        const sdk = this._platformSdk as TikTokSdk
        const interstitialAd = sdk.createInterstitialAd({
            adUnitId: placement,
        })

        interstitialAd.onClose(() => {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
        })

        interstitialAd.onError(() => {
            this._showAdFailurePopup(false)
        })

        interstitialAd.show()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(placement?: unknown): void {
        const sdk = this._platformSdk as TikTokSdk
        const rewardedAd = sdk.createRewardedVideoAd({
            adUnitId: placement,
        })

        rewardedAd.onClose((res) => {
            if (res && res.isEnded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            }
            this._setRewardedState(REWARDED_STATE.CLOSED)
        })

        rewardedAd.onError(() => {
            this._showAdFailurePopup(true)
        })

        rewardedAd.show()
            .then(() => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            })
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    addToHomeScreen(): Promise<unknown> {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN);
            (this._platformSdk as TikTokSdk).addShortcut({
                success: () => {
                    this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    getAddToHomeScreenReward(): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as TikTokSdk).getShortcutMissionReward({
                success: (result) => {
                    if (result?.canReceiveReward) {
                        resolve(undefined)
                    } else {
                        reject()
                    }
                },
                fail: () => {
                    reject()
                },
            })
        })
    }

    addToFavorites(): Promise<unknown> {
        if (!this.isAddToFavoritesSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES);
            (this._platformSdk as TikTokSdk).startEntranceMission({
                success: () => {
                    this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES)
                },
                fail: (error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_FAVORITES, error)
                },
            })
        }

        return promiseDecorator.promise
    }

    getAddToFavoritesReward(): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as TikTokSdk).getEntranceMissionReward({
                success: (result) => {
                    if (result?.canReceiveReward) {
                        resolve(undefined)
                    } else {
                        reject()
                    }
                },
                fail: () => {
                    reject()
                },
            })
        })
    }

    #getStorageItemRaw(key: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as TikTokSdk).getStorage({
                key,
                success: (result) => resolve(result.data),
                fail: (error) => reject(error),
            })
        })
    }

    #setStorageItem(key: string, value: unknown): Promise<void> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as TikTokSdk).setStorage({
                key,
                data: typeof value === 'object' ? JSON.stringify(value) : value,
                success: () => {
                    resolve()
                },
                fail: (error) => {
                    reject(error)
                },
            })
        })
    }

    #removeStorageItem(key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as TikTokSdk).removeStorage({
                key,
                success: () => {
                    resolve()
                },
                fail: (error) => {
                    reject(error)
                },
            })
        })
    }
}

export default TikTokPlatformBridge
