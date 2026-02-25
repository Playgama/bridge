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
} from '../constants'
import { addJavaScript, createAdvertisementBannerContainer } from '../common/utils'

const DEFAULT_SDK_URL = 'https://www.hippoobox.com/static/sdk/adsdk_1.9.5.js'
const INIT_TIMEOUT = 5000

class DlightekPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.DLIGHTEK
    }

    // advertisement
    get isBannerSupported() {
        return true
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    #initTimeout = null

    initialize() {
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
                const sdkUrl = this._options.sdkUrl || DEFAULT_SDK_URL

                addJavaScript(sdkUrl)
                    .then(() => {
                        if (!window.h5sdk) {
                            throw new Error('Dlightek SDK not found')
                        }

                        this._platformSdk = window.h5sdk

                        this.#initTimeout = setTimeout(() => {
                            if (!this._isInitialized) {
                                this.#completeInitialization()
                            }
                        }, INIT_TIMEOUT)

                        const adsenseOptions = {
                            client: this._options.adSenseId,
                            'data-ad-frequency-hint': this._options.adFrequencyHint || '45s',
                            callback: () => {
                                this._platformSdk.adConfig({
                                    preloadAdBreaks: 'on',
                                    sound: 'on',
                                    onReady: () => {
                                        if (!this._isInitialized) {
                                            clearTimeout(this.#initTimeout)
                                            this.#completeInitialization()
                                        }
                                    },
                                })
                            },
                        }

                        if (this._options.adChannel) {
                            adsenseOptions['data-ad-channel'] = this._options.adChannel
                        }

                        if (this._options.testMode) {
                            adsenseOptions['data-adbreak-test'] = 'on'
                        }

                        this._platformSdk.init(
                            this._options.appKey,
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

    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                return new Promise((resolve) => {
                    try {
                        if (this._platformSdk && this._platformSdk.gameLoadingCompleted) {
                            this._platformSdk.gameLoadingCompleted()
                        }
                    } catch (e) {
                        console.error(e)
                    }
                    resolve()
                })
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // advertisement
    showInterstitial(placement) {
        if (!this._platformSdk) {
            this._showAdFailurePopup(false)
            return
        }

        this._platformSdk.adBreak({
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

    showRewarded(placement) {
        if (!this._platformSdk) {
            this._showAdFailurePopup(true)
            return
        }

        this._platformSdk.adBreak({
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

    showBanner(position, placement) {
        if (this._bannerContainer) {
            return
        }

        this._bannerPlacement = placement
        this._bannerContainer = createAdvertisementBannerContainer(position)

        const ins = this.#createIns(placement)
        this._bannerContainer.appendChild(ins)

        this._setBannerState(BANNER_STATE.SHOWN)
    }

    hideBanner() {
        this._bannerContainer?.remove()
        this._bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    #completeInitialization() {
        this._playerApplyGuestData()
        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
    }

    #createIns(placementId) {
        const ins = document.createElement('ins')
        ins.style.display = 'block'
        ins.classList.add('adsbygoogle')
        ins.setAttribute('data-ad-client', this._options.adSenseId)
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

export default DlightekPlatformBridge
