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
    REWARDED_STATE,
    INTERSTITIAL_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    DEVICE_TYPE,
    DEVICE_OS,
    PLATFORM_MESSAGE,
    type PlatformId,
    type DeviceType,
    type DeviceOs,
    type StorageType,
    type CloudStorageMode,
} from '../constants'

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'
const ADS_SDK_URL = 'https://sad.adsgram.ai/js/sad.min.js'
const CLIPBOARD_READ_ACTION = 'clipboard_read'

interface TelegramUser {
    id: number
    first_name?: string
    last_name?: string
    photo_url?: string
    language_code: string
}

interface TelegramCloudStorage {
    getItem(key: string, callback: (error: unknown, value: string | null) => void): void
    getItems(keys: string[], callback: (error: unknown, values: Record<string, string>) => void): void
    getKeys(callback: (error: unknown, keys: string[]) => void): void
    setItem(key: string, value: string, callback?: (error: unknown) => void): void
    removeItem(key: string, callback?: (error: unknown) => void): void
}

interface TelegramSdk {
    initDataUnsafe: { user: TelegramUser }
    platform: string
    ready(): void
    CloudStorage: TelegramCloudStorage
    readTextFromClipboard(callback: (text: string) => void): void
}

interface AdsgramController {
    show(): Promise<unknown>
    addEventListener(event: string, listener: () => void): void
    removeEventListener(event: string, listener: () => void): void
}

interface AdsgramSdk {
    init(options: { blockId: string }): AdsgramController
}

declare global {
    interface Window {
        Telegram?: { WebApp: TelegramSdk }
        Adsgram?: AdsgramSdk
    }
}

class TelegramPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.TELEGRAM
    }

    get platformLanguage(): string {
        if (this._platformSdk) {
            return (this._platformSdk as TelegramSdk).initDataUnsafe.user.language_code
        }

        return super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return !!this.#adsController
    }

    get isRewardedSupported(): boolean {
        return !!this.#adsController
    }

    // device
    get deviceType(): DeviceType {
        switch (this.#platform) {
            case 'android':
            case 'android_x':
            case 'ios': {
                return DEVICE_TYPE.MOBILE
            }
            case 'tdesktop':
            case 'unigram':
            case 'macos': {
                return DEVICE_TYPE.DESKTOP
            }
            default: {
                return super.deviceType
            }
        }
    }

    get deviceOs(): DeviceOs {
        switch (this.#platform) {
            case 'android':
            case 'android_x': {
                return DEVICE_OS.ANDROID
            }
            case 'ios': {
                return DEVICE_OS.IOS
            }
            case 'macos': {
                return DEVICE_OS.MACOS
            }
            default: {
                return super.deviceOs
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady(): Promise<void> {
        return Promise.resolve()
    }

    protected _defaultStorageType: StorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    protected _isPlayerAuthorized = true

    #platform: string | undefined

    #adsController: AdsgramController | undefined

    #rewardedListeners = {
        onStart: () => this._setRewardedState(REWARDED_STATE.OPENED),
        onSkip: () => this._setRewardedState(REWARDED_STATE.CLOSED),
        onReward: () => this._setRewardedState(REWARDED_STATE.REWARDED),
        onError: () => this._showAdFailurePopup(true),
    }

    #interstitialListeners = {
        onStart: () => this._setInterstitialState(INTERSTITIAL_STATE.OPENED),
        onSkip: () => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED),
        onError: () => this._showAdFailurePopup(false),
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                this._platformSdk = (window.Telegram as { WebApp: TelegramSdk }).WebApp

                const sdk = this._platformSdk as TelegramSdk
                const { initDataUnsafe } = sdk
                const userData = initDataUnsafe.user

                this._playerId = String(userData.id)
                this._playerName = [userData.first_name, userData.last_name].filter(Boolean).join(' ')
                this._playerPhotos = userData.photo_url ? [userData.photo_url] : []

                this.#platform = sdk.platform

                this._isInitialized = true

                if (this._options && this._options.adsgramBlockId) {
                    addJavaScript(ADS_SDK_URL)
                        .then(() => {
                            this.#adsController = (window.Adsgram as AdsgramSdk).init({
                                blockId: this._options.adsgramBlockId as string,
                            })
                        })
                        .finally(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                } else {
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                }
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as TelegramSdk).ready()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // storage
    loadCloudSnapshot(): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const sdk = this._platformSdk as TelegramSdk
            sdk.CloudStorage.getKeys((keysError, keys) => {
                if (keysError) {
                    reject(keysError)
                    return
                }

                if (!keys || keys.length === 0) {
                    resolve({})
                    return
                }

                sdk.CloudStorage.getItems(keys, (itemsError, values) => {
                    if (itemsError) {
                        reject(itemsError)
                        return
                    }
                    resolve(values || {})
                })
            })
        })
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>, changedKeys: string[]): Promise<void> {
        const sdk = this._platformSdk as TelegramSdk
        return Promise.all(changedKeys.map((k) => new Promise<void>((resolve, reject) => {
            sdk.CloudStorage.setItem(k, snapshot[k] as string, (error) => {
                if (error) reject(error)
                else resolve()
            })
        }))).then(() => undefined)
    }

    deleteCloudKeys(_snapshot: Record<string, unknown>, deletedKeys: string[]): Promise<void> {
        const sdk = this._platformSdk as TelegramSdk
        return Promise.all(deletedKeys.map((k) => new Promise<void>((resolve, reject) => {
            sdk.CloudStorage.removeItem(k, (error) => {
                if (error) reject(error)
                else resolve()
            })
        }))).then(() => undefined)
    }

    // advertisement
    showInterstitial(): void {
        if (!this.#adsController) {
            this._showAdFailurePopup(false)
            return
        }
        const controller = this.#adsController
        controller.addEventListener('onStart', this.#interstitialListeners.onStart)
        controller.addEventListener('onSkip', this.#interstitialListeners.onSkip)
        controller.addEventListener('onError', this.#interstitialListeners.onError)
        controller.addEventListener('onBannerNotFound', this.#interstitialListeners.onError)
        controller.show().finally(() => {
            controller.removeEventListener('onStart', this.#interstitialListeners.onStart)
            controller.removeEventListener('onSkip', this.#interstitialListeners.onSkip)
            controller.removeEventListener('onError', this.#interstitialListeners.onError)
            controller.removeEventListener('onBannerNotFound', this.#interstitialListeners.onError)
        })
    }

    showRewarded(): void {
        if (!this.#adsController) {
            this._showAdFailurePopup(true)
            return
        }
        const controller = this.#adsController
        controller.addEventListener('onStart', this.#rewardedListeners.onStart)
        controller.addEventListener('onSkip', this.#rewardedListeners.onSkip)
        controller.addEventListener('onReward', this.#rewardedListeners.onReward)
        controller.addEventListener('onError', this.#rewardedListeners.onError)
        controller.addEventListener('onBannerNotFound', this.#rewardedListeners.onError)
        controller.show().finally(() => {
            controller.removeEventListener('onStart', this.#rewardedListeners.onStart)
            controller.removeEventListener('onSkip', this.#rewardedListeners.onSkip)
            controller.removeEventListener('onReward', this.#rewardedListeners.onReward)
            controller.removeEventListener('onError', this.#rewardedListeners.onError)
            controller.removeEventListener('onBannerNotFound', this.#rewardedListeners.onError)
        })
    }

    // clipboard
    clipboardRead(): Promise<string> {
        let promiseDecorator = this._getPromiseDecorator<string>(CLIPBOARD_READ_ACTION)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator<string>(CLIPBOARD_READ_ACTION);
            (this._platformSdk as TelegramSdk).readTextFromClipboard((text) => {
                if (text) {
                    this._resolvePromiseDecorator(CLIPBOARD_READ_ACTION, text)
                } else {
                    this._rejectPromiseDecorator(CLIPBOARD_READ_ACTION)
                }
            })
        }

        return promiseDecorator.promise
    }
}

export default TelegramPlatformBridge
