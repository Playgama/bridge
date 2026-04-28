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
    LEADERBOARD_TYPE,
    BANNER_STATE,
    type PlatformId,
    type LeaderboardType,
} from '../constants'

const SDK_URL = 'https://jiogames.akamaized.net/gameSDK/jiogames/stable/v2.0/jiogames_sdk.js'

interface JioGamesAdCallbacks {
    onAdPrepared?: () => void
    onAdClosed?: (isRewardUser?: boolean) => void
    onAdFailedToLoad?: (error: unknown) => void
}

interface JioGamesPlayerInfo {
    gamer_id?: string
    gamer_name?: string
    gamer_avatar_url?: string
    [key: string]: unknown
}

interface JioGamesSdk {
    playerInfo?: JioGamesPlayerInfo
    cacheAd(type: string, callbacks: JioGamesAdCallbacks): void
    showAd(type: string, callbacks: JioGamesAdCallbacks): void
    postScore(value: number): void
}

interface JioGamesBanner {
    loadBanner(): Promise<unknown>
    showBanner(position: string): void
    hideBanner(): void
}

declare global {
    interface Window {
        JioGames?: JioGamesSdk
        JGBanner?: JioGamesBanner
        AdType?: { Interstitial: string, Rewarded: string }
        BannerPosition?: { TOP: string, BOTTOM: string }
        onSdkReady?: () => void
        onBannerReady?: () => void
    }
}

class JioGamesPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.JIO_GAMES
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    get isBannerSupported(): boolean {
        return true
    }

    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    get isExternalLinksAllowed(): boolean {
        return false
    }

    protected _preloadInterstitialPromise: Promise<unknown> | null = null

    protected _preloadRewardedPromise: Promise<unknown> | null = null

    protected _isBannerAvailable = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            window.onSdkReady = () => {
                this._platformSdk = window.JioGames as JioGamesSdk
                const sdk = this._platformSdk as JioGamesSdk

                if (sdk.playerInfo) {
                    const {
                        gamer_id: id, gamer_name: name, gamer_avatar_url: photo, ...extra
                    } = sdk.playerInfo

                    this._playerId = id || null
                    this._playerName = name || null
                    if (photo) {
                        this._playerPhotos.push(photo)
                    }
                    this._playerExtra = extra

                    this._isPlayerAuthorized = true
                }

                this._isInitialized = true
                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
            }

            window.onBannerReady = () => {
                this._isBannerAvailable = true
            }

            const adTestMode = this._options.adTestMode as boolean | undefined
            addJavaScript(SDK_URL, adTestMode ? { 'data-jg-test-environment': 'on' } : {})
                .catch((error) => {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.INITIALIZE,
                        JSON.stringify(error),
                    )
                })
        }

        return promiseDecorator.promise
    }

    preloadInterstitial(): void {
        this.#preloadInterstitial()
    }

    showInterstitial(): void {
        this.#preloadInterstitial().then(() => {
            const sdk = this._platformSdk as JioGamesSdk
            sdk.showAd(window.AdType?.Interstitial ?? 'Interstitial', {
                onAdClosed: () => {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                },
                onAdFailedToLoad: (error) => {
                    console.error(error)
                    this._showAdFailurePopup(false)
                },
            })
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            this._preloadInterstitialPromise = null
        })
    }

    preloadRewarded(): void {
        this.#preloadRewarded()
    }

    showRewarded(): void {
        this.#preloadRewarded().then(() => {
            const sdk = this._platformSdk as JioGamesSdk
            sdk.showAd(window.AdType?.Rewarded ?? 'Rewarded', {
                onAdClosed: (isRewardUser) => {
                    if (isRewardUser) {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    }

                    this._setRewardedState(REWARDED_STATE.CLOSED)
                },
                onAdFailedToLoad: (error) => {
                    console.error(error)
                    this._showAdFailurePopup(true)
                },
            })
            this._setRewardedState(REWARDED_STATE.OPENED)
            this._preloadRewardedPromise = null
        })
    }

    showBanner(position?: unknown): void {
        if (!this._isBannerAvailable) {
            this._setBannerState(BANNER_STATE.FAILED)
            return
        }

        window.JGBanner?.loadBanner()
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
                window.JGBanner?.showBanner((position as string) || (window.BannerPosition?.TOP ?? 'TOP'))
            })
            .catch((error) => {
                console.error(error)
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        window.JGBanner?.hideBanner()

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    leaderboardsSetScore(_id?: unknown, score?: unknown, isMain?: unknown): Promise<unknown> {
        if (!isMain) {
            return Promise.reject()
        }

        const value = typeof score === 'string'
            ? parseInt(score, 10)
            : (score as number);
        (this._platformSdk as JioGamesSdk).postScore(value)

        return Promise.resolve()
    }

    #preloadInterstitial(): Promise<unknown> {
        if (this._preloadInterstitialPromise) {
            return this._preloadInterstitialPromise
        }

        this._preloadInterstitialPromise = new Promise((resolve, reject) => {
            const sdk = this._platformSdk as JioGamesSdk
            sdk.cacheAd(window?.AdType?.Interstitial ?? 'Interstitial', {
                onAdPrepared: () => resolve(undefined),
                onAdFailedToLoad: (error) => {
                    this._preloadInterstitialPromise = null
                    reject(new Error(String(error)))
                },
            })
        })

        return this._preloadInterstitialPromise
    }

    #preloadRewarded(): Promise<unknown> {
        if (this._preloadRewardedPromise) {
            return this._preloadRewardedPromise
        }

        this._preloadRewardedPromise = new Promise((resolve, reject) => {
            const sdk = this._platformSdk as JioGamesSdk
            sdk.cacheAd(window?.AdType?.Rewarded ?? 'Rewarded', {
                onAdPrepared: () => resolve(undefined),
                onAdFailedToLoad: (error) => {
                    this._preloadRewardedPromise = null
                    reject(new Error(String(error)))
                },
            })
        })

        return this._preloadRewardedPromise
    }
}

export default JioGamesPlatformBridge
