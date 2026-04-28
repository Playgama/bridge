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
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type LeaderboardType,
    type StorageType,
} from '../constants'

interface GameSnacksAdBreakOptions {
    type: 'next' | 'reward'
    name: string
    beforeAd?: () => void
    afterAd?: () => void
    beforeReward?: (showAdFn: () => void) => void
    adDismissed?: () => void
    adViewed?: () => void
    adBreakDone?: (placementInfo?: { breakStatus?: string }) => void
}

interface GameSnacksSdk {
    game: {
        ready(): void
        gameOver(): void
        levelComplete(level: number): void
        firstFrameReady(): void
        onPause(callback: () => void): void
        onResume(callback: () => void): void
    }
    audio: {
        isEnabled: boolean
        subscribe(callback: (isEnabled: boolean) => void): void
    }
    ad: {
        break(options: GameSnacksAdBreakOptions): void
    }
    storage: {
        getItem(key: string): string | null
        setItem(key: string, value: string): void
        removeItem(key: string): void
    }
    score: {
        update(score: unknown): Promise<unknown>
    }
}

declare global {
    interface Window {
        GameSnacks?: GameSnacksSdk
    }
}

class GameSnacksPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.GAMESNACKS
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    protected _isBannerSupported = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('GameSnacks').then(() => {
                this._platformSdk = window.GameSnacks as GameSnacksSdk
                this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

                const sdk = this._platformSdk as GameSnacksSdk
                sdk.game.onPause(() => {
                    this._setPauseState(true)
                })

                sdk.game.onResume(() => {
                    this._setPauseState(false)
                })

                sdk.audio.subscribe((isEnabled) => {
                    this._setAudioState(isEnabled)
                })

                sdk.game.firstFrameReady()
                this._setAudioState(sdk.audio.isEnabled)

                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as { level?: unknown }
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as GameSnacksSdk).game.ready()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                (this._platformSdk as GameSnacksSdk).game.gameOver()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.LEVEL_COMPLETED: {
                const level = Number(opts.level)
                if (!Number.isFinite(level)) {
                    return Promise.reject(new Error('Level is required for level_completed message'))
                }

                (this._platformSdk as GameSnacksSdk).game.levelComplete(level)
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // advertisement
    showInterstitial(placement?: unknown): void {
        (this._platformSdk as GameSnacksSdk).ad.break({
            type: 'next',
            name: (placement as string) || 'interstitial',
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as { interstitialState?: string }).interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo?.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }

    showRewarded(placement?: unknown): void {
        (this._platformSdk as GameSnacksSdk).ad.break({
            type: 'reward',
            name: (placement as string) || 'rewarded',
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as { rewardedState?: string }).rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn) => {
                showAdFn()
            },
            adDismissed: () => {
                this._showAdFailurePopup(true)
            },
            adViewed: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo?.breakStatus === 'frequencyCapped' || placementInfo?.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
    }

    // advertisement - adblock detection
    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
    }

    // storage
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as GameSnacksSdk
            if (Array.isArray(key)) {
                const values = key.map((storageKey) => this.#parseStorageValue(
                    sdk.storage.getItem(storageKey),
                    tryParseJson,
                ))
                return Promise.resolve(values)
            }

            const value = this.#parseStorageValue(sdk.storage.getItem(key), tryParseJson)
            return Promise.resolve(value)
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as GameSnacksSdk
            if (Array.isArray(key)) {
                const values = value as unknown[]
                for (let i = 0; i < key.length; i++) {
                    sdk.storage.setItem(key[i], this.#toStorageString(values[i]))
                }
                return Promise.resolve()
            }

            sdk.storage.setItem(key, this.#toStorageString(value))
            return Promise.resolve()
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const sdk = this._platformSdk as GameSnacksSdk
            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    sdk.storage.removeItem(key[i])
                }
                return Promise.resolve()
            }

            sdk.storage.removeItem(key)
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // leaderboards
    leaderboardsSetScore(_id?: unknown, score?: unknown): Promise<unknown> {
        return (this._platformSdk as GameSnacksSdk).score.update(score)
    }

    #toStorageString(value: unknown): string {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value)
        }

        if (typeof value === 'string') {
            return value
        }

        return String(value)
    }

    #parseStorageValue(value: unknown, tryParseJson: boolean): unknown {
        if (!tryParseJson || typeof value !== 'string') {
            return value
        }

        try {
            return JSON.parse(value)
        } catch (e) {
            return value
        }
    }
}

export default GameSnacksPlatformBridge
