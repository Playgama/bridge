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
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://playgama.com/sdk/v1.js'

class TheLoopPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.THE_LOOP
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    get platformLanguage() {
        return this._platformSdk?.platformService?.getLanguage?.() || super.platformLanguage
    }

    _isAdvancedBannersSupported = true

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('PLAYGAMA_SDK').then(() => {
                    this._platformSdk = window.PLAYGAMA_SDK

                    this._platformSdk.advService.subscribeToAdStateChanges((adType, state) => {
                        if (adType === 'interstitial') {
                            switch (state) {
                                case 'open': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                    break
                                }
                                case 'empty': {
                                    this._showAdFailurePopup(false)
                                    break
                                }
                                case 'close': {
                                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                    break
                                }
                                case 'error': {
                                    this._showAdFailurePopup(false)
                                    break
                                }
                                default: {
                                    break
                                }
                            }
                        } else if (adType === 'rewarded') {
                            switch (state) {
                                case 'open': {
                                    this._setRewardedState(REWARDED_STATE.OPENED)
                                    break
                                }
                                case 'empty': {
                                    this._showAdFailurePopup(true)
                                    break
                                }
                                case 'rewarded': {
                                    this._setRewardedState(REWARDED_STATE.REWARDED)
                                    break
                                }
                                case 'close': {
                                    this._setRewardedState(REWARDED_STATE.CLOSED)
                                    break
                                }
                                case 'error': {
                                    this._showAdFailurePopup(true)
                                    break
                                }
                                default: {
                                    break
                                }
                            }
                        }
                    })

                    const ready = this._platformSdk.platformService?.isReady || Promise.resolve()
                    ready.then(() => {
                        if (this._platformSdk.platformService?.getAdditionalParams) {
                            this._additionalData = this._platformSdk.platformService.getAdditionalParams() || {}
                        }

                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.gameService.gameReady()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    showInterstitial() {
        this._platformSdk.advService.showInterstitial()
    }

    showRewarded() {
        this._platformSdk.advService.showRewarded()
    }

    showAdvancedBanners(banners) {
        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        this._platformSdk.advService.showAdvancedBanners(banners)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
            })
    }

    hideAdvancedBanners() {
        this._platformSdk.advService.hideAdvancedBanners()
        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }
}

export default TheLoopPlatformBridge
