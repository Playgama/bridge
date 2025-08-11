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
    ERROR,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = 'https://cdn.y8.com/api/sdk.js'
const USERDATA_KEY = 'userData'
const NOT_FOUND_ERROR = 'Key not found'
const ADS_ID = '6129580795478709'

class Y8PlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.Y8
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // achievements
    get isAchievementsSupported() {
        return true
    }

    get isGetAchievementsListSupported() {
        return true
    }

    get isAchievementsNativePopupSupported() {
        return true
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.gameId) {
                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.Y8_GAME_PARAMS_NOT_FOUND)
            } else {
                addJavaScript(SDK_URL).then(() => {
                    waitFor('ID').then(() => {
                        this._platformSdk = window.ID

                        this._platformSdk.Event.subscribe('id.init', (() => {
                            addAdsByGoogle({
                                hostId: `ca-host-pub-${ADS_ID}`,
                                adsenseId: this._options.channelId
                                    ? `ca-pub-${ADS_ID}`
                                    : this._options.adsenseId,
                                channelId: this._options.channelId,
                            }).then(() => {
                                this._showAd = (o) => { window.adsbygoogle.push(o) }

                                window.adsbygoogle.push({
                                    preloadAdBreaks: 'on',
                                    sound: 'on',
                                    onReady: () => {},
                                })
                            })

                            this._platformSdk.getLoginStatus((data) => {
                                this.#updatePlayerInfo(data)
                                this._isInitialized = true
                                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            })
                        }))

                        this._platformSdk.init({
                            appId: this._options.gameId,
                        })
                    })
                })
            }
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        return new Promise(((resolve, reject) => {
            this._platformSdk.login((response) => {
                this.#updatePlayerInfo(response)
                if (response.status === 'ok') {
                    this._platformStorageCachedData = null
                    resolve()
                } else {
                    reject()
                }
            })
        }))
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                this.#getUserData()
                    .then((userData) => {
                        const keys = Array.isArray(key) ? key : [key]
                        const data = keys.map((_key) => {
                            const value = userData[_key]
                            return !tryParseJson && typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? null
                        })

                        resolve(data)
                    })
                    .catch(reject)
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                this.#getUserData()
                    .then((userData) => {
                        const newData = { ...userData }

                        if (Array.isArray(key)) {
                            for (let i = 0; i < key.length; i++) {
                                newData[key[i]] = value[i]
                            }
                        } else {
                            newData[key] = value
                        }

                        this._platformSdk.api('user_data/submit', 'POST', { key: USERDATA_KEY, value: JSON.stringify(newData) }, ((response) => {
                            if (response.status === 'ok') {
                                this._platformStorageCachedData = newData
                                resolve()
                            } else {
                                reject(response)
                            }
                        }))
                    })
                    .catch(reject)
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                this.#getUserData()
                    .then((userData) => {
                        const newData = { ...userData }

                        if (Array.isArray(key)) {
                            for (let i = 0; i < key.length; i++) {
                                delete newData[key[i]]
                            }
                        } else {
                            delete newData[key]
                        }

                        this._platformSdk.api('user_data/submit', 'POST', { key: USERDATA_KEY, value: JSON.stringify(newData) }, ((response) => {
                            if (response.status === 'ok') {
                                this._platformStorageCachedData = newData
                                resolve()
                            } else {
                                reject(response)
                            }
                        }))
                    })
                    .catch(reject)
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showInterstitial() {
        if (!this._showAd) {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            return
        }

        this._showAd({
            type: 'start',
            name: 'start-game',
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if (this.interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                }
            },
        })
    }

    showRewarded() {
        if (!this._showAd) {
            this._setRewardedState(REWARDED_STATE.FAILED)
            return
        }

        this._showAd({
            type: 'reward',
            name: 'rewarded Ad',
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if (this.rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn) => { showAdFn(0) },
            adDismissed: () => { this._setRewardedState(REWARDED_STATE.FAILED) },
            adViewed: () => { this._setRewardedState(REWARDED_STATE.REWARDED) },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus === 'frequencyCapped' || placementInfo.breakStatus === 'other') {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                }
            },
        })
    }

    // leaderboards
    leaderboardsSetScore(id, score) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const options = {
                table: id,
                points: score,
            }

            this._platformSdk.GameAPI.Leaderboards.save(options, ({ success, errormessage: error }) => {
                if (success) {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                }
            })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            const options = {
                table: id,
                mode: 'alltime',
            }

            this._platformSdk.GameAPI.Leaderboards.listCustom(options, ({ scores, success, errormessage: error }) => {
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
    unlockAchievement(options) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        if (!options.achievement || !options.achievementkey) {
            return Promise.reject()
        }

        return new Promise((resolve) => {
            this._platformSdk.GameAPI.Achievements.save(options, (data) => {
                resolve(data)
            })
        })
    }

    getAchievementsList(options) {
        return new Promise((resolve, reject) => {
            this._platformSdk.GameAPI.Achievements.listCustom(options, (data) => {
                if (data.success) {
                    resolve(data.achievements.map(({ player, ...achievement }) => ({
                        ...achievement,
                        playerid: player.playerid,
                        playername: player.playername,
                        lastupdated: player.lastupdated,
                        date: player.date,
                        rdate: player.rdate,
                    })))
                } else {
                    reject(new Error(data.errorcode))
                }
            })
        })
    }

    showAchievementsNativePopup(options) {
        this._platformSdk.GameAPI.Achievements.list(options)
        return Promise.resolve()
    }

    #getUserData() {
        return new Promise((resolve, reject) => {
            if (this._platformStorageCachedData) {
                resolve(this._platformStorageCachedData)
            } else {
                this._platformSdk.api('user_data/retrieve', 'POST', { key: USERDATA_KEY }, ((response) => {
                    if (response.error) {
                        if (response.error !== NOT_FOUND_ERROR) {
                            reject(response)
                        }
                    }

                    let userData = {}

                    try {
                        if (response.jsondata) {
                            userData = JSON.parse(response.jsondata)
                        }
                    } catch (e) {
                        // keep value string or null
                    }

                    this._platformStorageCachedData = userData
                    resolve(userData)
                }))
            }
        })
    }

    #updatePlayerInfo(data) {
        if (data.status === 'ok') {
            this._isPlayerAuthorized = true
            this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

            const {
                pid, locale, nickname, first_name: firstName, last_name: lastName, avatars,
            } = data.authResponse.details

            if (pid) {
                this._playerId = pid
            }

            this._platformLanguage = locale

            this._playerName = [firstName, lastName].filter((x) => !!x).join(' ') || nickname

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
