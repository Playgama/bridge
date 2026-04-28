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
} from '../constants'
import { addAdsByGoogle, createAdvertisementBannerContainer } from '../common/utils'
import type { AnyRecord } from '../types/common'

interface FunmaxApi {
    loadStart?: () => void
    loadReady?: () => void
}

declare global {
    interface Window {
        funmax?: FunmaxApi
    }
}

type ShowAdFn = (options: AnyRecord) => unknown

class XiaomiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.XIAOMI
    }

    // advertisement
    get isBannerSupported(): boolean {
        return true
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 30
    }

    get isRewardedSupported(): boolean {
        return true
    }

    #showAd: ShowAdFn | null = null

    #bannerContainer: HTMLDivElement | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        try {
            if (window.funmax && window.funmax.loadStart) {
                window.funmax.loadStart()
            }
        } catch (e) {
            console.error(e)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this._options?.adSenseId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addAdsByGoogle({
                    adSenseId: this._options.adSenseId as string,
                    testMode: !!this._options.testMode,
                }).then((showAd) => {
                    this.#showAd = showAd as ShowAdFn
                }).finally(() => {
                    this._playerApplyGuestData()

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
            }
        }

        return promiseDecorator.promise
    }

    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                return new Promise((resolve) => {
                    try {
                        if (window.funmax && window.funmax.loadReady) {
                            window.funmax.loadReady()
                        }
                    } catch (e) {
                        console.error(e)
                    }
                    resolve(undefined)
                })
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // advertisement
    showBanner(position?: unknown, placement?: unknown): void {
        if (this.#bannerContainer) {
            return
        }

        this.#bannerContainer = createAdvertisementBannerContainer(position as never)

        const ins = this.#createIns(placement as string)
        this.#bannerContainer.appendChild(ins)

        this._setBannerState(BANNER_STATE.SHOWN)
    }

    hideBanner(): void {
        this.#bannerContainer?.remove()
        this.#bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial(placement?: unknown): void {
        if (!this.#showAd) {
            this._showAdFailurePopup(false)
            return
        }

        this.#showAd({
            type: 'start',
            name: placement,
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as AnyRecord).interstitialState !== INTERSTITIAL_STATE.FAILED) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                }
            },
            adBreakDone: (placementInfo: AnyRecord) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }

    showRewarded(placement?: unknown): void {
        if (!this.#showAd) {
            this._showAdFailurePopup(true)
            return
        }

        this.#showAd({
            type: 'reward',
            name: placement,
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                if ((this as unknown as AnyRecord).rewardedState !== REWARDED_STATE.FAILED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            },
            beforeReward: (showAdFn: (n: number) => void) => { showAdFn(0) },
            adDismissed: () => { },
            adViewed: () => { this._setRewardedState(REWARDED_STATE.REWARDED) },
            adBreakDone: (placementInfo: AnyRecord) => {
                if (placementInfo.breakStatus === 'frequencyCapped' || placementInfo.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
    }

    #createIns(placementId: string): HTMLElement {
        const ins = document.createElement('ins')
        ins.style.display = 'block'
        ins.classList.add('adsbygoogle')
        ins.setAttribute('data-ad-client', this._options.adSenseId as string)
        ins.setAttribute('data-ad-slot', placementId)
        ins.setAttribute('data-ad-format', 'auto')
        ins.setAttribute('data-container-id', BANNER_CONTAINER_ID)
        ins.setAttribute('data-full-width-responsive', 'true')

        if (this._options.testMode) {
            ins.setAttribute('data-adtest', 'on')
        }

        return ins
    }
}

export default XiaomiPlatformBridge
