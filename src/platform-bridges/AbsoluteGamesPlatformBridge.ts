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
    type PlatformId,
    type StorageType,
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

                        this._defaultStorageType = this._isPlayerAuthorized
                            ? STORAGE_TYPE.PLATFORM_INTERNAL
                            : STORAGE_TYPE.LOCAL_STORAGE

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
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (this._platformStorageCachedData) {
                    const cached = this._platformStorageCachedData as AnyRecord

                    if (Array.isArray(key)) {
                        const values: unknown[] = []

                        for (let i = 0; i < key.length; i++) {
                            const value = typeof cached[key[i]] === 'undefined'
                                ? null
                                : cached[key[i]]

                            values.push(value)
                        }

                        resolve(values)
                        return
                    }

                    resolve(typeof cached[key] === 'undefined' ? null : cached[key])
                    return
                }

                if (this._isPlayerAuthorized) {
                    (this._platformSdk as AgRuSdkInstance).getSaveData((data, error) => {
                        if (error === null) {
                            this._platformStorageCachedData = data || {}
                            const cached = this._platformStorageCachedData as AnyRecord

                            if (Array.isArray(key)) {
                                const values: unknown[] = []

                                for (let i = 0; i < key.length; i++) {
                                    const value = typeof cached[key[i]] === 'undefined'
                                        ? null
                                        : cached[key[i]]

                                    values.push(value)
                                }

                                resolve(values)
                                return
                            }

                            resolve(typeof cached[key] === 'undefined' ? null : cached[key])
                        } else {
                            reject(error)
                        }
                    })
                } else {
                    reject()
                }
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (this._isPlayerAuthorized) {
                    const cached = this._platformStorageCachedData as AnyRecord | null
                    const data: AnyRecord = cached !== null
                        ? { ...cached }
                        : {}

                    if (Array.isArray(key)) {
                        const values = value as unknown[]
                        for (let i = 0; i < key.length; i++) {
                            data[key[i]] = values[i]
                        }
                    } else {
                        data[key] = value
                    }

                    (this._platformSdk as AgRuSdkInstance).setSaveData(data, (_result, error) => {
                        if (error === null) {
                            this._platformStorageCachedData = data
                            resolve()
                        }
                        reject(error)
                    })
                } else {
                    reject()
                }
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                if (this._isPlayerAuthorized) {
                    const cached = this._platformStorageCachedData as AnyRecord | null
                    const data: AnyRecord = cached !== null
                        ? { ...cached }
                        : {}

                    if (Array.isArray(key)) {
                        for (let i = 0; i < key.length; i++) {
                            delete data[key[i]]
                        }
                    } else {
                        delete data[key]
                    }

                    (this._platformSdk as AgRuSdkInstance).setSaveData(data, (_result, error) => {
                        if (error === null) {
                            this._platformStorageCachedData = data
                            resolve()
                        }
                        reject(error)
                    })
                } else {
                    reject()
                }
            })
        }

        return super.deleteDataFromStorage(key, storageType)
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
