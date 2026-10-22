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
import crossPromoModule from '../modules/cross-promo'
import type { VideoPreview } from '../lib/bridge-config'
import { createSubscribeNotification } from '../lib/subscribe-notification'
import { waitFor } from '../utils'
import { ACTION_NAME } from '../constants'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    VISIBILITY_STATE,
    type PlatformId,
} from '../modules/platform/constants'
import { DEVICE_TYPE } from '../modules/device/constants'
import {
    REWARDED_STATE,
    INTERSTITIAL_STATE,
} from '../modules/advertisement/constants'
import { LEADERBOARD_TYPE, type LeaderboardType } from '../modules/leaderboards/constants'

interface YtgameSystem {
    getLanguage(): Promise<string>
    isAudioEnabled(): boolean
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
    openYTContent(content: { id: string }): Promise<unknown>
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

    get isPlatformExternalCallsSupported(): boolean {
        return false
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

    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    get isClipboardSupported(): boolean {
        return false
    }

    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    // storage
    #platformLanguage: string | undefined

    #subscribeNotification: HTMLDivElement | null = null

    #videoPreview: HTMLDivElement | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (this.deviceType === DEVICE_TYPE.DESKTOP) {
                this.#subscribeNotification = createSubscribeNotification(this._options.subscribeNotificationType)
                this.#videoPreview = this.#createVideoPreview()
            }

            waitFor('ytgame').then(() => {
                this._platformSdk = window.ytgame as YtgameSdk
                const sdk = this._platformSdk as YtgameSdk
                this._setPlatformStorageAvailable(true)
                const getLanguagePromise = sdk.system.getLanguage()
                    .then((language) => {
                        this.#platformLanguage = language.length > 2 ? language.slice(0, 2) : language
                    })

                sdk.system.onAudioEnabledChange((isEnabled) => {
                    this._setAudioState(isEnabled)
                })

                this.#syncAudioState()

                // onAudioEnabledChange is not delivered on some Android devices when the toggle
                // happens while the game iframe is paused or frozen, so re-read the actual state
                // every time the game comes back to the foreground
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === VISIBILITY_STATE.VISIBLE) {
                        this.#syncAudioState()
                    }
                })

                window.addEventListener('pageshow', () => {
                    this.#syncAudioState()
                })

                sdk.system.onPause(() => {
                    this._setPauseState(true)
                    this.#tryShowCrossPromo()
                })

                sdk.system.onResume(() => {
                    this._setPauseState(false)
                    crossPromoModule.hide()
                    this.#syncAudioState()
                })

                Promise.all([getLanguagePromise])
                    .finally(() => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        sdk.game.firstFrameReady()
                    })
            })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(): Promise<Record<string, unknown>> {
        return (this._platformSdk as YtgameSdk).game.loadData().then((data) => {
            if (typeof data === 'string' && data !== '') {
                try {
                    return JSON.parse(data)
                } catch {
                    return {}
                }
            }
            return {}
        })
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        const snapshot = await this.getDataFromStorage()
        Object.keys(data).forEach((key) => {
            snapshot[key] = data[key]
        })
        await (this._platformSdk as YtgameSdk).game.saveData(JSON.stringify(snapshot))
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        const snapshot = await this.getDataFromStorage()
        keys.forEach((key) => {
            delete snapshot[key]
        })
        await (this._platformSdk as YtgameSdk).game.saveData(JSON.stringify(snapshot))
    }

    sendMessage(message?: unknown, _options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                (this._platformSdk as YtgameSdk).game.gameReady()
                if (this.#subscribeNotification) {
                    this.#subscribeNotification.remove()
                    this.#subscribeNotification = null
                }
                if (this.#videoPreview) {
                    this.#videoPreview.remove()
                    this.#videoPreview = null
                }
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

    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
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

    #syncAudioState(): void {
        this._setAudioState((this._platformSdk as YtgameSdk).system.isAudioEnabled())
    }

    #tryShowCrossPromo(): void {
        const interstitialActive = this._pauseStateAggregator?.getState('interstitial')
        const rewardedActive = this._pauseStateAggregator?.getState('rewarded')
        if (interstitialActive || rewardedActive) {
            return
        }

        crossPromoModule.show()
    }

    #createVideoPreview(): HTMLDivElement | null {
        const previews = (this._options.videoPreviews ?? [])
            .filter((preview): preview is VideoPreview => Boolean(preview?.image && preview?.videoId))
        if (previews.length === 0) {
            return null
        }

        const { image, videoId } = previews[Math.floor(Math.random() * previews.length)]

        if (!document.getElementById('bridge-youtube-video-preview-styles')) {
            const style = document.createElement('style')
            style.id = 'bridge-youtube-video-preview-styles'
            style.textContent = `
                #bridge-youtube-video-preview {
                    position: fixed;
                    bottom: -24px;
                    right: 24px;
                    width: min(256px, 40vw);
                    border-radius: 16px;
                    overflow: hidden;
                    background-color: #000;
                    box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.4);
                    cursor: pointer;
                    opacity: 0;
                    z-index: 9999999;
                    animation: bridge-yt-preview-rise 285ms ease-out 590ms forwards;
                }

                #bridge-youtube-video-preview .bridge-yt-preview-image {
                    display: block;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    object-fit: cover;
                    user-select: none;
                    -webkit-user-drag: none;
                }

                #bridge-youtube-video-preview .bridge-yt-preview-play {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 48px;
                    height: 34px;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }

                @keyframes bridge-yt-preview-rise {
                    0%   { bottom: -24px;  opacity: 0; }
                    40%  { bottom: 25.6px; opacity: 1; }
                    48%  { bottom: 33.6px; }
                    60%  { bottom: 32px; }
                    70%  { bottom: 30.4px; }
                    79%  { bottom: 28.8px; }
                    88%  { bottom: 27.2px; }
                    95%  { bottom: 25.6px; }
                    100% { bottom: 24px;   opacity: 1; }
                }
            `
            document.head.appendChild(style)
        }

        const container = document.createElement('div')
        container.id = 'bridge-youtube-video-preview'

        const img = document.createElement('img')
        img.className = 'bridge-yt-preview-image'
        img.src = image
        img.alt = ''
        img.draggable = false
        container.appendChild(img)

        container.insertAdjacentHTML('beforeend', `
            <svg class="bridge-yt-preview-play" viewBox="0 0 68 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M66.52 7.74C65.74 4.81 64.03 2.33 61.1 1.55C55.79 0.13 34 0 34 0C34 0 12.21 0.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74C0.06 13.05 0 24 0 24C0 24 0.06 34.95 1.48 40.26C2.27 43.19 3.97 45.67 6.9 46.45C12.21 47.87 34 48 34 48C34 48 55.79 47.87 61.1 46.45C64.03 45.67 65.74 43.19 66.52 40.26C67.94 34.95 68 24 68 24C68 24 67.94 13.05 66.52 7.74Z" fill="#FF0033"/>
                <path d="M45 24L27 14V34L45 24Z" fill="white"/>
            </svg>
        `)

        container.addEventListener('click', () => {
            window.ytgame?.engagement.openYTContent({ id: videoId }).catch(() => {})
        })

        document.body.appendChild(container)
        return container
    }
}

export default YoutubePlatformBridge
