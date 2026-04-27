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
    CLOUD_STORAGE_MODE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
    REWARDED_STATE,
    INTERSTITIAL_STATE,
} from '../constants'

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

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE
    }

    // storage
    get cloudStorageMode() {
        return CLOUD_STORAGE_MODE.EAGER
    }

    get cloudStorageReady() {
        return Promise.resolve()
    }

    #platformLanguage

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            waitFor('ytgame').then(() => {
                this._platformSdk = window.ytgame
                this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                const getLanguagePromise = this._platformSdk.system.getLanguage()
                    .then((language) => {
                        this.#platformLanguage = language.length > 2 ? language.slice(0, 2) : language
                    })

                this._platformSdk.system.onAudioEnabledChange((isEnabled) => {
                    this._setAudioState(isEnabled)
                })

                this._platformSdk.system.onPause(() => {
                    this._setPauseState(true)
                })

                this._platformSdk.system.onResume(() => {
                    this._setPauseState(false)
                })

                Promise.all([getLanguagePromise])
                    .finally(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        this._platformSdk.game.firstFrameReady()
                    })
            })
        }

        return promiseDecorator.promise
    }

    // storage
    loadCloudSnapshot() {
        return this._platformSdk.game.loadData().then((data) => {
            if (typeof data === 'string' && data !== '') {
                try {
                    return JSON.parse(data)
                } catch (e) {
                    return {}
                }
            }
            return {}
        })
    }

    saveCloudSnapshot(snapshot) {
        return this._platformSdk.game.saveData(JSON.stringify(snapshot))
    }

    deleteCloudKeys(snapshot) {
        return this._platformSdk.game.saveData(JSON.stringify(snapshot))
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

    // advertisement
    showInterstitial() {
        this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        this._platformSdk.ads.requestInterstitialAd()
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(placement) {
        this._setRewardedState(REWARDED_STATE.OPENED)
        this._platformSdk.ads.requestRewardedAd(placement)
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
