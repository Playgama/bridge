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
import { waitFor } from '../utils'
import { ACTION_NAME } from '../constants'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
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

    get isExternalLinksAllowed(): boolean {
        return false
    }

    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    // storage
    #platformLanguage: string | undefined

    #subscribeNotification: HTMLDivElement | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (this.deviceType === DEVICE_TYPE.DESKTOP) {
                this.#subscribeNotification = this.#createSubscribeNotification()
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

                sdk.system.onPause(() => {
                    this._setPauseState(true)
                    this.#tryShowCrossPromo()
                })

                sdk.system.onResume(() => {
                    this._setPauseState(false)
                    crossPromoModule.hide()
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

    #tryShowCrossPromo(): void {
        const interstitialActive = this._pauseStateAggregator?.getState('interstitial')
        const rewardedActive = this._pauseStateAggregator?.getState('rewarded')
        if (interstitialActive || rewardedActive) {
            return
        }

        crossPromoModule.show()
    }

    #createSubscribeNotification(): HTMLDivElement {
        if (!document.getElementById('bridge-youtube-subscribe-styles')) {
            const style = document.createElement('style')
            style.id = 'bridge-youtube-subscribe-styles'
            style.textContent = `
                #bridge-youtube-subscribe {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    transform-origin: 168px calc(100% - 56px);
                    z-index: 9999999;
                    animation: bridge-yt-press 650ms ease-in-out 1270ms forwards;
                }

                #bridge-youtube-subscribe .bridge-yt-button {
                    position: fixed;
                    bottom: -24px;
                    left: 24px;
                    width: 220.8px;
                    height: 64px;
                    border-radius: 107.8px;
                    padding: 11.2px 25.6px 12.8px 25.6px;
                    background-color: #9747FF;
                    box-shadow: inset 0 0 17.06px 0 rgba(151, 71, 255, 0.7), inset 0 0 16px 0 rgba(255, 255, 255, 0.7);
                    box-sizing: border-box;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    pointer-events: none;
                    animation:
                        bridge-yt-rise-button 285ms ease-out 590ms forwards,
                        bridge-yt-button-shrink 295ms cubic-bezier(0.4, 0, 0.2, 1) 2100ms forwards;
                }

                #bridge-youtube-subscribe .bridge-yt-title {
                    width: 168.8px;
                    height: 28.8px;
                    display: block;
                    flex-shrink: 0;
                }

                #bridge-youtube-subscribe .bridge-yt-ball {
                    position: fixed;
                    bottom: -88px;
                    left: 248px;
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background-color: #9747FF;
                    box-shadow: inset 0 0 17.06px 0 rgba(151, 71, 255, 0.7), inset 0 0 16px 0 rgba(255, 255, 255, 0.7);
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    animation:
                        bridge-yt-rise-ball 285ms ease-out 630ms forwards,
                        bridge-yt-ball-roll 470ms cubic-bezier(0.34, 1.2, 0.5, 1) 2100ms forwards;
                }

                #bridge-youtube-subscribe .bridge-yt-ball svg {
                    position: absolute;
                }

                #bridge-youtube-subscribe .bridge-yt-arrow {
                    width: 25.6px;
                    height: 25.6px;
                    opacity: 1;
                    animation: bridge-yt-arrow-fade-out 235ms ease 2220ms forwards;
                }

                #bridge-youtube-subscribe .bridge-yt-hand {
                    width: 28.8px;
                    height: 28.8px;
                    opacity: 0;
                    animation: bridge-yt-hand-fade-in 235ms ease 2335ms forwards;
                }

                @keyframes bridge-yt-rise-button {
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
                @keyframes bridge-yt-rise-ball {
                    0%   { bottom: -88px;  opacity: 0; }
                    40%  { bottom: 25.6px; opacity: 1; }
                    48%  { bottom: 33.6px; }
                    60%  { bottom: 32px; }
                    70%  { bottom: 30.4px; }
                    79%  { bottom: 28.8px; }
                    88%  { bottom: 27.2px; }
                    95%  { bottom: 25.6px; }
                    100% { bottom: 24px;   opacity: 1; }
                }
                @keyframes bridge-yt-press {
                    0%   { transform: scale(1); }
                    25%  { transform: scale(0.94); }
                    40%  { transform: scale(0.9); }
                    65%  { transform: scale(1.01); }
                    82%  { transform: scale(0.995); }
                    100% { transform: scale(1); }
                }
                @keyframes bridge-yt-button-shrink {
                    0%   { width: 220.8px; opacity: 1; }
                    100% { width: 64px;    opacity: 0; }
                }
                @keyframes bridge-yt-ball-roll {
                    0%   { left: 248px; transform: rotate(0deg); }
                    100% { left: 24px;  transform: rotate(-360deg); }
                }
                @keyframes bridge-yt-arrow-fade-out {
                    to { opacity: 0; }
                }
                @keyframes bridge-yt-hand-fade-in {
                    to { opacity: 1; }
                }
            `
            document.head.appendChild(style)
        }

        const container = document.createElement('div')
        container.id = 'bridge-youtube-subscribe'
        container.innerHTML = `
            <div class="bridge-yt-button">
                <svg class="bridge-yt-title" viewBox="0 0 211 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.864 35.664C10.208 35.664 7.75999 35.104 5.51999 33.984C3.31199 32.832 1.47199 30.976 -1.09524e-05 28.416L5.80799 24.72C6.67199 26.448 7.75999 27.712 9.07199 28.512C10.384 29.28 11.776 29.664 13.248 29.664C14.816 29.664 16.048 29.312 16.944 28.608C17.84 27.904 18.288 26.976 18.288 25.824C18.288 24.704 17.936 23.808 17.232 23.136C16.528 22.464 15.584 21.92 14.4 21.504C13.248 21.088 11.984 20.704 10.608 20.352C8.01599 19.68 5.95199 18.576 4.41599 17.04C2.87999 15.472 2.11199 13.424 2.11199 10.896C2.11199 8.88004 2.60799 7.12004 3.59999 5.61604C4.59199 4.11204 5.96799 2.94404 7.72799 2.11204C9.51999 1.28004 11.6 0.864038 13.968 0.864038C16.592 0.864038 18.784 1.40804 20.544 2.49604C22.304 3.58404 23.808 5.12004 25.056 7.10404L19.296 10.656C18.496 9.34404 17.664 8.38404 16.8 7.77604C15.936 7.16804 14.88 6.86404 13.632 6.86404C12.288 6.86404 11.168 7.20004 10.272 7.87204C9.40799 8.54404 8.97599 9.44004 8.97599 10.56C8.97599 11.808 9.48799 12.72 10.512 13.296C11.568 13.84 12.832 14.336 14.304 14.784C15.296 15.104 16.4 15.488 17.616 15.936C18.864 16.352 20.064 16.944 21.216 17.712C22.368 18.448 23.312 19.44 24.048 20.688C24.784 21.936 25.152 23.52 25.152 25.44C25.152 27.456 24.656 29.232 23.664 30.768C22.672 32.304 21.264 33.504 19.44 34.368C17.616 35.232 15.424 35.664 12.864 35.664ZM37.3759 35.616C35.5839 35.616 33.9679 35.2 32.5279 34.368C31.0879 33.536 29.9519 32.352 29.1199 30.816C28.2879 29.248 27.8719 27.424 27.8719 25.344V10.08H34.3519V23.76C34.3519 25.904 34.7839 27.472 35.6479 28.464C36.5119 29.456 37.7439 29.952 39.3439 29.952C40.7199 29.952 41.9199 29.456 42.9439 28.464C43.9999 27.472 44.5279 25.904 44.5279 23.76V10.08H51.0079V35.04H44.7199V31.296C44.1119 32.736 43.2159 33.824 42.0319 34.56C40.8799 35.264 39.3279 35.616 37.3759 35.616ZM69.1826 35.664C66.9426 35.664 65.1986 35.232 63.9506 34.368C62.7346 33.504 61.7906 32.368 61.1186 30.96V35.04H54.8306V3.8147e-05H61.3106V13.92C61.9826 12.608 62.9266 11.552 64.1426 10.752C65.3586 9.95204 67.0386 9.55204 69.1826 9.55204C70.9106 9.55204 72.5106 9.90404 73.9826 10.608C75.4866 11.28 76.7986 12.224 77.9186 13.44C79.0386 14.624 79.9186 16.016 80.5586 17.616C81.1986 19.184 81.5186 20.864 81.5186 22.656C81.5186 25.056 80.9586 27.248 79.8386 29.232C78.7506 31.184 77.2786 32.752 75.4226 33.936C73.5666 35.088 71.4866 35.664 69.1826 35.664ZM68.1266 29.808C69.5026 29.808 70.7026 29.472 71.7266 28.8C72.7826 28.128 73.5986 27.248 74.1746 26.16C74.7506 25.04 75.0386 23.856 75.0386 22.608C75.0386 21.296 74.7506 20.096 74.1746 19.008C73.5986 17.92 72.7826 17.056 71.7266 16.416C70.7026 15.744 69.5026 15.408 68.1266 15.408C66.7186 15.408 65.4866 15.744 64.4306 16.416C63.3746 17.088 62.5586 17.968 61.9826 19.056C61.4066 20.144 61.1186 21.344 61.1186 22.656C61.1186 23.936 61.4066 25.12 61.9826 26.208C62.5586 27.296 63.3746 28.176 64.4306 28.848C65.4866 29.488 66.7186 29.808 68.1266 29.808ZM92.4371 35.664C88.2451 35.664 84.7891 34.208 82.0691 31.296L86.4371 27.312C88.2611 29.36 90.2131 30.384 92.2931 30.384C93.4131 30.384 94.2611 30.144 94.8371 29.664C95.4451 29.152 95.7491 28.528 95.7491 27.792C95.7491 27.344 95.6371 26.96 95.4131 26.64C95.2211 26.32 94.7891 26.016 94.1171 25.728C93.4771 25.44 92.5011 25.152 91.1891 24.864C88.9491 24.32 87.2851 23.648 86.1971 22.848C85.1091 22.048 84.3891 21.152 84.0371 20.16C83.6851 19.168 83.5091 18.144 83.5091 17.088C83.5091 14.912 84.3251 13.104 85.9571 11.664C87.6211 10.192 89.9091 9.45604 92.8211 9.45604C94.8371 9.45604 96.5651 9.76004 98.0051 10.368C99.4451 10.976 100.805 12.112 102.085 13.776L97.3811 17.376C96.7731 16.416 96.0851 15.728 95.3171 15.312C94.5811 14.896 93.7971 14.688 92.9651 14.688C92.0691 14.688 91.3171 14.864 90.7091 15.216C90.1331 15.568 89.8451 16.128 89.8451 16.896C89.8451 17.312 90.0371 17.728 90.4211 18.144C90.8051 18.528 91.7331 18.912 93.2051 19.296C95.6371 19.904 97.4931 20.624 98.7731 21.456C100.053 22.256 100.933 23.168 101.413 24.192C101.893 25.216 102.133 26.352 102.133 27.6C102.133 29.136 101.701 30.512 100.837 31.728C100.005 32.944 98.8531 33.904 97.3811 34.608C95.9411 35.312 94.2931 35.664 92.4371 35.664ZM116.563 35.664C114.771 35.664 113.091 35.328 111.523 34.656C109.987 33.984 108.627 33.056 107.443 31.872C106.259 30.656 105.331 29.264 104.659 27.696C104.019 26.096 103.699 24.384 103.699 22.56C103.699 20.128 104.259 17.936 105.379 15.984C106.531 14 108.099 12.416 110.083 11.232C112.099 10.048 114.371 9.45604 116.899 9.45604C119.171 9.42404 121.203 9.82404 122.995 10.656C124.787 11.488 126.211 12.64 127.267 14.112L122.275 18.192C121.699 17.328 120.947 16.64 120.019 16.128C119.123 15.616 118.115 15.36 116.995 15.36C115.619 15.36 114.419 15.696 113.395 16.368C112.371 17.008 111.571 17.872 110.995 18.96C110.451 20.048 110.179 21.248 110.179 22.56C110.179 23.84 110.467 25.04 111.043 26.16C111.651 27.248 112.467 28.128 113.491 28.8C114.547 29.44 115.763 29.76 117.139 29.76C118.387 29.76 119.443 29.488 120.307 28.944C121.171 28.368 121.923 27.648 122.563 26.784L127.267 30.864C126.083 32.368 124.611 33.552 122.851 34.416C121.123 35.248 119.027 35.664 116.563 35.664ZM129.831 35.04V10.08H136.119V14.832C136.535 13.04 137.383 11.68 138.663 10.752C139.943 9.79204 141.671 9.37604 143.847 9.50404V15.6H142.935C141.079 15.6 139.511 16.192 138.231 17.376C136.951 18.56 136.311 20.192 136.311 22.272V35.04H129.831ZM149.218 8.01604C148.13 8.01604 147.202 7.64804 146.434 6.91204C145.698 6.14404 145.33 5.23204 145.33 4.17604C145.33 3.15204 145.698 2.27204 146.434 1.53604C147.202 0.768037 148.13 0.384036 149.218 0.384036C150.338 0.384036 151.266 0.768037 152.002 1.53604C152.738 2.27204 153.106 3.15204 153.106 4.17604C153.106 5.26404 152.738 6.17604 152.002 6.91204C151.266 7.64804 150.338 8.01604 149.218 8.01604ZM146.002 35.04V10.08H152.482V35.04H146.002ZM170.667 35.664C168.427 35.664 166.683 35.232 165.435 34.368C164.219 33.504 163.275 32.368 162.603 30.96V35.04H156.315V3.8147e-05H162.795V13.92C163.467 12.608 164.411 11.552 165.627 10.752C166.843 9.95204 168.523 9.55204 170.667 9.55204C172.395 9.55204 173.995 9.90404 175.467 10.608C176.971 11.28 178.283 12.224 179.403 13.44C180.523 14.624 181.403 16.016 182.043 17.616C182.683 19.184 183.003 20.864 183.003 22.656C183.003 25.056 182.443 27.248 181.323 29.232C180.235 31.184 178.763 32.752 176.907 33.936C175.051 35.088 172.971 35.664 170.667 35.664ZM169.611 29.808C170.987 29.808 172.187 29.472 173.211 28.8C174.267 28.128 175.083 27.248 175.659 26.16C176.235 25.04 176.523 23.856 176.523 22.608C176.523 21.296 176.235 20.096 175.659 19.008C175.083 17.92 174.267 17.056 173.211 16.416C172.187 15.744 170.987 15.408 169.611 15.408C168.203 15.408 166.971 15.744 165.915 16.416C164.859 17.088 164.043 17.968 163.467 19.056C162.891 20.144 162.603 21.344 162.603 22.656C162.603 23.936 162.891 25.12 163.467 26.208C164.043 27.296 164.859 28.176 165.915 28.848C166.971 29.488 168.203 29.808 169.611 29.808ZM197.611 35.664C195.051 35.664 192.795 35.072 190.843 33.888C188.891 32.704 187.371 31.136 186.283 29.184C185.227 27.2 184.699 25.008 184.699 22.608C184.699 20.208 185.259 18.016 186.379 16.032C187.499 14.016 189.019 12.416 190.939 11.232C192.891 10.048 195.115 9.45604 197.611 9.45604C200.107 9.45604 202.299 10.048 204.187 11.232C206.107 12.416 207.595 14.016 208.651 16.032C209.739 18.016 210.283 20.208 210.283 22.608C210.283 22.96 210.267 23.328 210.235 23.712C210.203 24.096 210.155 24.496 210.091 24.912H191.419C191.771 26.384 192.475 27.584 193.531 28.512C194.619 29.44 195.979 29.904 197.611 29.904C199.019 29.904 200.235 29.584 201.259 28.944C202.315 28.304 203.131 27.504 203.707 26.544L208.747 30.336C207.755 31.904 206.267 33.184 204.283 34.176C202.299 35.168 200.075 35.664 197.611 35.664ZM197.515 15.024C195.979 15.024 194.667 15.488 193.579 16.416C192.491 17.344 191.771 18.56 191.419 20.064H203.755C203.403 18.688 202.667 17.504 201.547 16.512C200.459 15.52 199.115 15.024 197.515 15.024Z" fill="white"/>
                </svg>
            </div>
            <div class="bridge-yt-ball">
                <svg class="bridge-yt-arrow" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24.6532 13.488L28.7812 17.184L16.1572 30.288L3.5332 17.184L7.7092 13.488L13.2772 19.392L13.1332 0H19.1812L19.0372 19.488L24.6532 13.488Z" fill="white"/>
                </svg>
                <svg class="bridge-yt-hand" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.7501 0C16.9946 0 18.0001 1.00547 18.0001 2.25V16.875H13.5001V2.25C13.5001 1.00547 14.5056 0 15.7501 0ZM22.5001 11.25C23.7446 11.25 24.7501 12.2555 24.7501 13.5V18C24.7501 19.2445 23.7446 20.25 22.5001 20.25C21.2556 20.25 20.2501 19.2445 20.2501 18V13.5C20.2501 12.2555 21.2556 11.25 22.5001 11.25ZM27.0001 15.75C27.0001 14.5055 28.0056 13.5 29.2501 13.5C30.4946 13.5 31.5001 14.5055 31.5001 15.75V20.25C31.5001 21.4945 30.4946 22.5 29.2501 22.5C28.0056 22.5 27.0001 21.4945 27.0001 20.25V15.75ZM6.56024 3.6L12.3681 16.875H7.45321L2.43993 5.4C1.94071 4.26094 2.46102 2.93906 3.60009 2.43984C4.73915 1.94063 6.06806 2.46094 6.56024 3.6ZM8.45868 19.1602L8.44462 19.125H13.3595H15.1946C16.7485 19.125 18.0071 20.3836 18.0071 21.9375C18.0071 23.4914 16.7485 24.75 15.1946 24.75H11.2571C10.6384 24.75 10.1321 25.2563 10.1321 25.875C10.1321 26.4937 10.6384 27 11.2571 27H15.1946C17.9931 27 20.2571 24.7359 20.2571 21.9375V21.8953C20.9181 22.275 21.6845 22.5 22.5071 22.5C23.4352 22.5 24.2931 22.2188 25.0102 21.7406C25.622 23.4914 27.2954 24.75 29.2571 24.75C30.0798 24.75 30.8462 24.532 31.5071 24.1453V24.75C31.5071 30.9656 26.4727 36 20.2571 36H15.9188C12.9376 36 10.0759 34.8117 7.96649 32.7023L7.15087 31.8867C5.4493 30.1992 4.50009 27.907 4.50009 25.5234V23.625C4.50009 21.3258 6.22977 19.4273 8.45868 19.1602Z" fill="white"/>
                </svg>
            </div>
        `

        document.body.appendChild(container)
        return container
    }
}

export default YoutubePlatformBridge
