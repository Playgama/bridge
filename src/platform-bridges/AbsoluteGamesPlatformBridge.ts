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
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    type PlatformId,
    type CloudStorageMode,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://unpkg.com/@agru/sdk/dist/umd/index.min.js'

interface AgRuCampaignData {
    type: 'rewarded' | 'default' | string
    status: boolean
    reward?: unknown
}

interface AgRuPlayerData {
    full_name?: string
    avatar?: string
}

interface AgRuSdkInstance {
    options: {
        player_id: string
        guest: string
    }
    on(method: unknown, callback: (data: AgRuCampaignData, error: unknown) => void): void
    authorize(callback: (data: unknown, error: unknown) => void): void
    getSaveData(callback: (data: AnyRecord, error: unknown) => void): void
    setSaveData(data: AnyRecord, callback: (result: unknown, error: unknown) => void): void
    showCampaign(type: string): void
    getUsers(ids: string[], callback: (data: AgRuPlayerData[]) => void): void
}

interface AgRuSdkConstructor {
    new (): AgRuSdkInstance
}

interface AgRuSdkMethods {
    ShowCampaign: unknown
}

declare global {
    interface Window {
        AgRuSdk?: AgRuSdkConstructor
        AgRuSdkMethods?: AgRuSdkMethods
    }
}

class AbsoluteGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.ABSOLUTE_GAMES
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // social
    get isExternalLinksAllowed(): boolean {
        return false
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                this._platformSdk = new (window.AgRuSdk as AgRuSdkConstructor)();
                (this._platformSdk as AgRuSdkInstance).on(
                    (window.AgRuSdkMethods as AgRuSdkMethods).ShowCampaign,
                    (data, error) => {
                        switch (data.type) {
                            case 'rewarded': {
                                if (error === null) {
                                    if (data.status) {
                                        this._setRewardedState(REWARDED_STATE.OPENED)
                                    } else {
                                        if (data.reward) {
                                            this._setRewardedState(REWARDED_STATE.REWARDED)
                                        }

                                        this._setRewardedState(REWARDED_STATE.CLOSED)
                                    }
                                } else {
                                    this._showAdFailurePopup(true)
                                }
                                break
                            }
                            case 'default':
                            default: {
                                if (error === null) {
                                    if (data.status) {
                                        this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                    } else {
                                        this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                    }
                                } else {
                                    this._showAdFailurePopup(false)
                                }
                                break
                            }
                        }
                    },
                )

                const getPlayerInfoPromise = this.#getPlayerInfo()

                Promise
                    .all([getPlayerInfoPromise])
                    .finally(() => {
                        this._isInitialized = true

                        this._setDefaultStorageType(
                            this._isPlayerAuthorized
                                ? STORAGE_TYPE.PLATFORM_INTERNAL
                                : STORAGE_TYPE.LOCAL_STORAGE,
                        )

                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
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
            (this._platformSdk as AgRuSdkInstance).authorize((_data, error) => {
                if (error === null) {
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                }
            })
        }

        return promiseDecorator.promise
    }

    // storage
    loadCloudSnapshot(): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as AgRuSdkInstance).getSaveData((data, error) => {
                if (error === null) {
                    resolve(data || {})
                } else {
                    reject(error)
                }
            })
        })
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            (this._platformSdk as AgRuSdkInstance).setSaveData(snapshot, (_result, error) => {
                if (error === null) {
                    resolve()
                } else {
                    reject(error)
                }
            })
        })
    }

    deleteCloudKeys(snapshot: Record<string, unknown>): Promise<void> {
        return this.saveCloudSnapshot(snapshot)
    }

    // advertisement
    showInterstitial(): void {
        (this._platformSdk as AgRuSdkInstance).showCampaign('default')
    }

    showRewarded(): void {
        (this._platformSdk as AgRuSdkInstance).showCampaign('rewarded')
    }

    #getPlayerInfo(): Promise<void> {
        const sdk = this._platformSdk as AgRuSdkInstance
        this._playerId = sdk.options.player_id
        this._isPlayerAuthorized = sdk.options.guest === 'false'

        return new Promise((resolve) => {
            sdk.getUsers([this._playerId as string], (data) => {
                if (data && data.length === 1) {
                    const playerData = data[0]
                    this._playerName = playerData.full_name ?? null

                    if (playerData.avatar && playerData.avatar !== '') {
                        this._playerPhotos = [playerData.avatar]
                    }
                }

                resolve()
            })
        })
    }
}

export default AbsoluteGamesPlatformBridge
