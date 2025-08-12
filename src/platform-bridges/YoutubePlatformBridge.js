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
    STORAGE_TYPE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = 'https://www.youtube.com/game_api/v1'

class YoutubePlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.YOUTUBE
    }

    get platformLanguage() {
        if (this.#platformLanguage) {
            return this.#platformLanguage
        }

        return super.platformLanguage
    }

    get isPlatformAudioEnabled() {
        return this.#isAudioEnabled
    }

    get isPlatformPaused() {
        return this.#isPaused
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    #platformLanguage

    #isAudioEnabled = true

    #isPaused = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('ytgame').then(() => {
                    this._platformSdk = window.ytgame
                    this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                    this.#isAudioEnabled = this._platformSdk.system.isAudioEnabled()

                    const getLanguagePromise = this._platformSdk.system.getLanguage()
                        .then((language) => {
                            this.#platformLanguage = language.length > 2 ? language.slice(0, 2) : language
                        })

                    this._platformStorageCachedData = {}
                    const getDataPromise = this._platformSdk.game.loadData()
                        .then((data) => {
                            if (typeof data === 'string' && data !== '') {
                                this._platformStorageCachedData = JSON.parse(data)
                            }
                        })

                    this._platformSdk.system.onAudioEnabledChange((isEnabled) => {
                        this.#isAudioEnabled = isEnabled
                        this._setAudioState(isEnabled)
                    })

                    this._platformSdk.system.onPause(() => {
                        this.#isPaused = true
                        this._setPauseState(this.#isPaused)
                    })

                    this._platformSdk.system.onResume(() => {
                        this.#isPaused = false
                        this._setPauseState(this.#isPaused)
                    })

                    Promise.all([getLanguagePromise, getDataPromise])
                        .finally(() => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            this._platformSdk.game.firstFrameReady()
                        })
                })
            })
        }

        return promiseDecorator.promise
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
            return true
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                this._platformSdk.game.loadData()
                    .then((data) => {
                        if (typeof data === 'string' && data !== '') {
                            this._platformStorageCachedData = JSON.parse(data)
                        }

                        if (Array.isArray(key)) {
                            const values = []

                            for (let i = 0; i < key.length; i++) {
                                let value = typeof this._platformStorageCachedData[key[i]] === 'undefined'
                                    ? null
                                    : this._platformStorageCachedData[key[i]]

                                if (typeof value === 'string' && tryParseJson) {
                                    try {
                                        value = JSON.parse(value)
                                    } catch (e) {
                                        // keep value as-is
                                    }
                                }

                                values.push(value)
                            }

                            resolve(values)
                            return
                        }

                        let value = typeof this._platformStorageCachedData[key] === 'undefined'
                            ? null
                            : this._platformStorageCachedData[key]

                        if (typeof value === 'string' && tryParseJson) {
                            try {
                                value = JSON.parse(value)
                            } catch (e) {
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

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = this._platformStorageCachedData !== null
                    ? { ...this._platformStorageCachedData }
                    : {}

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = value[i]
                    }
                } else {
                    data[key] = value
                }

                this._platformSdk.game.saveData(JSON.stringify(data))
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

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = this._platformStorageCachedData !== null
                    ? { ...this._platformStorageCachedData }
                    : {}

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        delete data[key[i]]
                    }
                } else {
                    delete data[key]
                }

                this._platformSdk.game.saveData(JSON.stringify(data))
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

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.game.gameReady()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // leaderboards
    leaderboardsSetScore(id, score, isMain) {
        if (!isMain) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const value = typeof score === 'string'
                ? parseInt(score, 10)
                : score

            this._platformSdk.engagement.sendScore({ value })
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
