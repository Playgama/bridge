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
import { waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    STORAGE_TYPE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
    REWARDED_STATE,
    INTERSTITIAL_STATE,
    type PlatformId,
    type StorageType,
    type LeaderboardType,
} from '../constants'

interface YtgameSystem {
    getLanguage(): Promise<string>
    onAudioEnabledChange(callback: (isEnabled: boolean) => void): void
    onPause(callback: () => void): void
    onResume(callback: () => void): void
}

interface YtgameGame {
    loadData(): Promise<string>
    saveData(data: string): Promise<unknown>
    gameReady(): void
    firstFrameReady(): void
}

interface YtgameAds {
    requestInterstitialAd(): Promise<unknown>
    requestRewardedAd(placement?: unknown): Promise<boolean>
}

interface YtgameEngagement {
    sendScore(options: { value: number }): Promise<unknown>
}

interface YtgameSdk {
    system: YtgameSystem
    game: YtgameGame
    ads: YtgameAds
    engagement: YtgameEngagement
}

declare global {
    interface Window {
        ytgame?: YtgameSdk
    }
}

class YoutubePlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.YOUTUBE
    }

    get platformLanguage(): string {
        if (this.#platformLanguage) {
            return this.#platformLanguage
        }

        return super.platformLanguage
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    get isExternalLinksAllowed(): boolean {
        return false
    }

    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    #platformLanguage: string | undefined

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('ytgame').then(() => {
                this._platformSdk = window.ytgame as YtgameSdk
                const sdk = this._platformSdk as YtgameSdk
                this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                const getLanguagePromise = sdk.system.getLanguage()
                    .then((language) => {
                        this.#platformLanguage = language.length > 2 ? language.slice(0, 2) : language
                    })

                this._platformStorageCachedData = {}
                const getDataPromise = sdk.game.loadData()
                    .then((data) => {
                        if (typeof data === 'string' && data !== '') {
                            this._platformStorageCachedData = JSON.parse(data)
                        }
                    })

                sdk.system.onAudioEnabledChange((isEnabled) => {
                    this._setAudioState(isEnabled)
                })

                sdk.system.onPause(() => {
                    this._setPauseState(true)
                })

                sdk.system.onResume(() => {
                    this._setPauseState(false)
                })

                Promise.all([getLanguagePromise, getDataPromise])
                    .finally(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        sdk.game.firstFrameReady()
                    })
            })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                (this._platformSdk as YtgameSdk).game.loadData()
                    .then((data) => {
                        if (typeof data === 'string' && data !== '') {
                            this._platformStorageCachedData = JSON.parse(data)
                        }

                        const cached = this._platformStorageCachedData as Record<string, unknown>

                        if (Array.isArray(key)) {
                            const values: unknown[] = []

                            for (let i = 0; i < key.length; i++) {
                                let value: unknown = typeof cached[key[i]] === 'undefined'
                                    ? null
                                    : cached[key[i]]

                                if (typeof value === 'string' && tryParseJson) {
                                    try {
                                        value = JSON.parse(value)
                                    } catch {
                                        // keep value as-is
                                    }
                                }

                                values.push(value)
                            }

                            resolve(values)
                            return
                        }

                        let value: unknown = typeof cached[key] === 'undefined'
                            ? null
                            : cached[key]

                        if (typeof value === 'string' && tryParseJson) {
                            try {
                                value = JSON.parse(value)
                            } catch {
                                // keep value as-is
                            }
                        }

                        resolve(value)
                    })
                    .catch(() => {
                        reject()
                    })
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data: Record<string, unknown> = this._platformStorageCachedData !== null
                    ? { ...(this._platformStorageCachedData as Record<string, unknown>) }
                    : {}

                if (Array.isArray(key)) {
                    const values = value as unknown[]
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = values[i]
                    }
                } else {
                    data[key] = value
                }

                (this._platformSdk as YtgameSdk).game.saveData(JSON.stringify(data))
                    .then(() => {
                        this._platformStorageCachedData = data
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data: Record<string, unknown> = this._platformStorageCachedData !== null
                    ? { ...(this._platformStorageCachedData as Record<string, unknown>) }
                    : {}

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        delete data[key[i]]
                    }
                } else {
                    delete data[key]
                }

                (this._platformSdk as YtgameSdk).game.saveData(JSON.stringify(data))
                    .then(() => {
                        this._platformStorageCachedData = data
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    sendMessage(message?: unknown, _options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as YtgameSdk).game.gameReady()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    showInterstitial(): void {
        this._setInterstitialState(INTERSTITIAL_STATE.OPENED);
        (this._platformSdk as YtgameSdk).ads.requestInterstitialAd()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(placement?: unknown): void {
        this._setRewardedState(REWARDED_STATE.OPENED);
        (this._platformSdk as YtgameSdk).ads.requestRewardedAd(placement)
            .then((isRewardEarned) => {
                if (isRewardEarned) {
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                }

                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    leaderboardsSetScore(_id?: unknown, score?: unknown, isMain?: unknown): Promise<unknown> {
        if (!isMain) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const value = typeof score === 'string'
                ? parseInt(score, 10)
                : (score as number);
            (this._platformSdk as YtgameSdk).engagement.sendScore({ value })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }
}

export default YoutubePlatformBridge
