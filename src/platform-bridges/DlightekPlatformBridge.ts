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
import {
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
    BANNER_STATE,
    BANNER_CONTAINER_ID,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    PLATFORM_MESSAGE,
    type PlatformId,
    type BannerPosition,
} from '../constants'
import { addJavaScript, createAdvertisementBannerContainer } from '../common/utils'

const SDK_URL = 'https://www.hippoobox.com/static/sdk/adsdk_1.9.5.js'
const INIT_TIMEOUT = 5000

interface DlightekAdBreakOptions {
    type: string
    name?: unknown
    beforeAd?: () => void
    afterAd?: () => void
    beforeReward?: (showAdFn: (delay: number) => void) => void
    adDismissed?: () => void
    adViewed?: () => void
    adBreakDone?: (placementInfo: { breakStatus: string }) => void
}

interface DlightekAdsenseOptions {
    client: string
    'data-ad-frequency-hint': string
    callback: () => void
    'data-ad-channel'?: string
    'data-adbreak-test'?: string
}

interface DlightekSdk {
    init(
        appKey: string,
        a: string,
        b: string,
        c: string,
        d: string,
        options: { adsense: DlightekAdsenseOptions },
    ): void
    adConfig(options: { preloadAdBreaks: string, sound: string, onReady: () => void }): void
    adBreak(options: DlightekAdBreakOptions): void
    gameLoadingCompleted?(): void
}

declare global {
    interface Window {
        h5sdk?: DlightekSdk
    }
}

class DlightekPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.DLIGHTEK
    }

    get isBannerSupported(): boolean {
        return true
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    protected _bannerContainer: HTMLDivElement | null = null

    protected _bannerPlacement: unknown = null

    #initTimeout: ReturnType<typeof setTimeout> | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.appKey || !this._options?.adSenseId) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addJavaScript(SDK_URL)
                    .then(() => {
                        if (!window.h5sdk) {
                            throw new Error('Dlightek SDK not found')
                        }

                        this._platformSdk = window.h5sdk
                        const sdk = this._platformSdk as DlightekSdk

                        this.#initTimeout = setTimeout(() => {
                            if (!this._isInitialized) {
                                this.#completeInitialization()
                            }
                        }, INIT_TIMEOUT)

                        const adsenseOptions: DlightekAdsenseOptions = {
                            client: this._options.adSenseId as string,
                            'data-ad-frequency-hint': '45s',
                            callback: () => {
                                sdk.adConfig({
                                    preloadAdBreaks: 'on',
                                    sound: 'on',
                                    onReady: () => {
                                        if (!this._isInitialized) {
                                            if (this.#initTimeout) {
                                                clearTimeout(this.#initTimeout)
                                            }
                                            this.#completeInitialization()
                                        }
                                    },
                                })
                            },
                        }

                        if (this._options.adChannel) {
                            adsenseOptions['data-ad-channel'] = this._options.adChannel as string
                        }

                        if (this._options.testMode) {
                            adsenseOptions['data-adbreak-test'] = 'on'
                        }

                        sdk.init(
                            this._options.appKey as string,
                            '',
                            '',
                            '',
                            '',
                            { adsense: adsenseOptions },
                        )
                    })
                    .catch(() => {
                        this.#completeInitialization()
                    })
            }
        }

        return promiseDecorator.promise
    }

    sendMessage(message?: unknown, _options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                return new Promise((resolve) => {
                    try {
                        const sdk = this._platformSdk as DlightekSdk | null
                        if (sdk && sdk.gameLoadingCompleted) {
                            sdk.gameLoadingCompleted()
                        }
                    } catch (e) {
                        console.error(e)
                    }
                    resolve(undefined)
                })
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    showInterstitial(placement?: unknown): void {
        if (!this._platformSdk) {
            this._showAdFailurePopup(false)
            return
        }

        (this._platformSdk as DlightekSdk).adBreak({
            type: 'start',
            name: placement,
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }

    showRewarded(placement?: unknown): void {
        if (!this._platformSdk) {
            this._showAdFailurePopup(true)
            return
        }

        (this._platformSdk as DlightekSdk).adBreak({
            type: 'reward',
            name: placement,
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            },
            beforeReward: (showAdFn) => { showAdFn(0) },
            adDismissed: () => {},
            adViewed: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus === 'frequencyCapped'
                    || placementInfo.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
    }

    showBanner(position?: unknown, placement?: unknown): void {
        if (this._bannerContainer) {
            return
        }

        this._bannerPlacement = placement
        this._bannerContainer = createAdvertisementBannerContainer(position as BannerPosition)

        const ins = this.#createIns(placement)
        this._bannerContainer.appendChild(ins)

        this._setBannerState(BANNER_STATE.SHOWN)
    }

    hideBanner(): void {
        this._bannerContainer?.remove()
        this._bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    #completeInitialization(): void {
        this._playerApplyGuestData()
        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
    }

    #createIns(placementId: unknown): HTMLElement {
        const ins = document.createElement('ins')
        ins.style.display = 'block'
        ins.classList.add('adsbygoogle')
        ins.setAttribute('data-ad-client', this._options.adSenseId as string)
        ins.setAttribute('data-ad-slot', String(placementId ?? ''))
        ins.setAttribute('data-ad-format', 'auto')
        ins.setAttribute('data-container-id', BANNER_CONTAINER_ID)
        ins.setAttribute('data-full-width-responsive', 'true')

        if (this._options.testMode) {
            ins.setAttribute('data-adtest', 'on')
        }

        return ins
    }
}

export default DlightekPlatformBridge
