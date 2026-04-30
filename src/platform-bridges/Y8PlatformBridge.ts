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
import { addAdsByGoogle, addJavaScript, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type CloudStorageMode,
    type LeaderboardType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = 'https://cdn.y8.com/api/sdk.js'
const USERDATA_KEY = 'userData'
const NOT_FOUND_ERROR = 'Key not found'
const ADS_ID = '6129580795478709'

interface Y8LoginResponse {
    status: string
    authResponse?: {
        details: {
            pid?: string
            locale?: string
            nickname?: string
            // eslint-disable-next-line @typescript-eslint/naming-convention
            first_name?: string
            // eslint-disable-next-line @typescript-eslint/naming-convention
            last_name?: string
            avatars: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                thumb_url?: string
                // eslint-disable-next-line @typescript-eslint/naming-convention
                medium_url?: string
                // eslint-disable-next-line @typescript-eslint/naming-convention
                large_url?: string
            }
        }
    }
}

interface Y8ApiResponse {
    status?: string
    error?: string
    jsondata?: string
    [key: string]: unknown
}

interface Y8AdShowFn {
    (config: AnyRecord): unknown
}

interface Y8Sdk {
    Event: {
        subscribe(eventName: string, callback: () => void): void
    }
    init(options: { appId: string }): void
    getLoginStatus(callback: (data: Y8LoginResponse) => void): void
    login(callback: (data: Y8LoginResponse) => void): void
    api(method: string, httpMethod: string, params: AnyRecord, callback: (response: Y8ApiResponse) => void): void
    GameAPI: {
        Leaderboards: {
            save(options: AnyRecord, callback: (response: { success: boolean; errormessage?: unknown }) => void): void
            listCustom(options: AnyRecord, callback: (response: { success: boolean; scores: AnyRecord[]; errormessage?: unknown }) => void): void
        }
        Achievements: {
            save(options: AnyRecord, callback: (data: unknown) => void): void
            listCustom(options: AnyRecord, callback: (data: { success: boolean; achievements: AnyRecord[]; errorcode?: string }) => void): void
            list(options: AnyRecord): void
        }
    }
}

declare global {
    interface Window {
        ID?: Y8Sdk
    }
}

class Y8PlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.Y8
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 60
    }

    get isRewardedSupported(): boolean {
        return true
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
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // achievements
    get isAchievementsSupported(): boolean {
        return true
    }

    get isGetAchievementsListSupported(): boolean {
        return true
    }

    get isAchievementsNativePopupSupported(): boolean {
        return true
    }

    #showAd: Y8AdShowFn | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.gameId) {
                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
            } else {
                addJavaScript(SDK_URL).then(() => {
                    waitFor('ID').then(() => {
                        this._platformSdk = window.ID as Y8Sdk;
                        (this._platformSdk as Y8Sdk).Event.subscribe('id.init', (() => {
                            addAdsByGoogle({
                                adSenseId: this._options.channelId
                                    ? `ca-pub-${ADS_ID}`
                                    : this._options.adsenseId as string,
                                channelId: this._options.channelId as string | undefined,
                                hostId: `ca-host-pub-${ADS_ID}`,
                            }).then((showAd) => {
                                this.#showAd = showAd as Y8AdShowFn
                            });
                            (this._platformSdk as Y8Sdk).getLoginStatus((data) => {
                                this.#updatePlayerInfo(data)
                                this._isInitialized = true
                                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            })
                        }));
                        (this._platformSdk as Y8Sdk).init({
                            appId: this._options.gameId as string,
                        })
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer(): Promise<unknown> {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        return new Promise(((resolve, reject) => {
            (this._platformSdk as Y8Sdk).login((response) => {
                this.#updatePlayerInfo(response)
                if (response.status === 'ok') {
                    resolve(undefined)
                } else {
                    reject()
                }
            })
        }))
    }

    // storage
    loadCloudSnapshot(): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as Y8Sdk).api('user_data/retrieve', 'POST', { key: USERDATA_KEY }, ((response) => {
                if (response.error && response.error !== NOT_FOUND_ERROR) {
                    reject(response)
                    return
                }

                let userData: AnyRecord = {}
                try {
                    if (response.jsondata) {
                        userData = JSON.parse(response.jsondata as string)
                    }
                } catch {
                    userData = {}
                }
                resolve(userData)
            }))
        })
    }

    saveCloudSnapshot(snapshot: Record<string, unknown>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            (this._platformSdk as Y8Sdk).api(
                'user_data/submit',
                'POST',
                { key: USERDATA_KEY, value: JSON.stringify(snapshot) },
                ((response) => {
                    if (response.status === 'ok') {
                        resolve()
                    } else {
                        reject(response)
                    }
                }),
            )
        })
    }

    deleteCloudKeys(snapshot: Record<string, unknown>): Promise<void> {
        return this.saveCloudSnapshot(snapshot)
    }

    // advertisement
    showInterstitial(): void {
        if (!this.#showAd) {
            this._showAdFailurePopup(false)
            return
        }

        this.#showAd({
            type: 'start',
            name: 'start-game',
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as { interstitialState?: string }).interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo: { breakStatus: string }) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }

    showRewarded(): void {
        if (!this.#showAd) {
            this._showAdFailurePopup(true)
            return
        }

        this.#showAd({
            type: 'reward',
            name: 'rewarded Ad',
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as { rewardedState?: string }).rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn: (n: number) => void) => { showAdFn(0) },
            adDismissed: () => { this._showAdFailurePopup(true) },
            adViewed: () => { this._setRewardedState(REWARDED_STATE.REWARDED) },
            adBreakDone: (placementInfo: { breakStatus: string }) => {
                if (placementInfo.breakStatus === 'frequencyCapped' || placementInfo.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
    }

    // leaderboards
    leaderboardsSetScore(id: string, score: number): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const options = {
                table: id,
                points: score,
            };
            (this._platformSdk as Y8Sdk).GameAPI.Leaderboards.save(options, ({ success, errormessage: error }) => {
                if (success) {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                }
            })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id: string): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            const options = {
                table: id,
                mode: 'alltime',
            };
            (this._platformSdk as Y8Sdk).GameAPI.Leaderboards.listCustom(options, ({ scores, success, errormessage: error }) => {
                if (success) {
                    const entries = scores.map((entry) => ({
                        id: entry.playerid,
                        name: entry.playername,
                        score: entry.points,
                        rank: entry.rank,
                        photo: null,
                    }))
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, error)
                }
            })
        }

        return promiseDecorator.promise
    }

    // achievements
    unlockAchievement(options?: AnyRecord): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        if (!options || !options.achievement || !options.achievementkey) {
            return Promise.reject()
        }

        return new Promise((resolve) => {
            (this._platformSdk as Y8Sdk).GameAPI.Achievements.save(options, (data) => {
                resolve(data)
            })
        })
    }

    getAchievementsList(options?: AnyRecord): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as Y8Sdk).GameAPI.Achievements.listCustom(options ?? {}, (data) => {
                if (data.success) {
                    resolve(data.achievements.map(({ player, ...achievement }) => {
                        const p = player as AnyRecord
                        return {
                            ...achievement,
                            playerid: p.playerid,
                            playername: p.playername,
                            lastupdated: p.lastupdated,
                            date: p.date,
                            rdate: p.rdate,
                        }
                    }))
                } else {
                    reject(new Error(data.errorcode))
                }
            })
        })
    }

    showAchievementsNativePopup(options?: AnyRecord): Promise<unknown> {
        (this._platformSdk as Y8Sdk).GameAPI.Achievements.list(options ?? {})
        return Promise.resolve()
    }

    #updatePlayerInfo(data: Y8LoginResponse): void {
        if (data.status === 'ok' && data.authResponse) {
            this._isPlayerAuthorized = true
            this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)

            const {
                pid, locale, nickname, first_name: firstName, last_name: lastName, avatars,
            } = data.authResponse.details

            if (pid) {
                this._playerId = pid
            }

            (this as unknown as { _platformLanguage?: string })._platformLanguage = locale

            this._playerName = [firstName, lastName].filter((x) => !!x).join(' ') || nickname || null

            this._playerPhotos = []

            const {
                thumb_url: photoSmall, medium_url: photoMedium, large_url: photoLarge,
            } = avatars

            if (photoSmall) {
                this._playerPhotos.push(photoSmall)
            }

            if (photoMedium) {
                this._playerPhotos.push(photoMedium)
            }

            if (photoLarge) {
                this._playerPhotos.push(photoLarge)
            }
        }
    }
}

export default Y8PlatformBridge
