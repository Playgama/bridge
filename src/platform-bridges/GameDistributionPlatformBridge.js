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
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE, ERROR,
} from '../constants'

const SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js'
const BANNER_CONTAINER_ID = 'banner-container'

class GameDistributionPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.GAME_DISTRIBUTION
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    #currentAdvertisementIsRewarded = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options || typeof this._options.gameId !== 'string') {
                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_DISTRIBUTION_GAME_ID_IS_UNDEFINED)
            } else {
                const self = this
                window.GD_OPTIONS = {
                    gameId: this._options.gameId,
                    onEvent(event) {
                        switch (event.name) {
                            case 'SDK_READY':
                                self._platformSdk = window.gdsdk
                                self._platformSdk.preloadAd('rewarded')
                                self._isInitialized = true

                                self.showInterstitial()
                                self._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                break
                            case 'SDK_GAME_START':
                                if (self.#currentAdvertisementIsRewarded) {
                                    self._setRewardedState(REWARDED_STATE.CLOSED)
                                } else {
                                    self._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                                }
                                break
                            case 'SDK_GAME_PAUSE':
                                if (self.#currentAdvertisementIsRewarded) {
                                    self._setRewardedState(REWARDED_STATE.OPENED)
                                } else {
                                    self._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                                }
                                break
                            case 'SDK_REWARDED_WATCH_COMPLETE':
                                self._setRewardedState(REWARDED_STATE.REWARDED)
                                break
                            case 'SDK_GDPR_TRACKING':
                            case 'SDK_GDPR_TARGETING':
                            default:
                                break
                        }
                    },
                }

                this._defaultStorageType = STORAGE_TYPE.LOCAL_STORAGE
                this._isBannerSupported = true
                addJavaScript(SDK_URL)
            }
        }

        return promiseDecorator.promise
    }

    // advertisement
    showBanner(options) {
        let container = document.getElementById(BANNER_CONTAINER_ID)

        if (!container) {
            container = document.createElement('div')
            container.id = BANNER_CONTAINER_ID
            container.style.position = 'absolute'
            document.body.appendChild(container)
        }

        if (options?.position === 'top') {
            container.style.top = 0
            container.style.height = '90px'
            container.style.width = '100%'
        } else if (options?.position === 'left') {
            container.style.left = 0
            container.style.top = 0
            container.style.height = '100%'
            container.style.minHeight = '600px'
            container.style.width = '120px'
        } else if (options?.position === 'right') {
            container.style.right = 0
            container.style.top = 0
            container.style.height = '100%'
            container.style.minHeight = '600px'
            container.style.width = '120px'
        } else {
            container.style.bottom = 0
            container.style.height = '90px'
            container.style.width = '100%'
        }

        container.style.display = 'block'

        this._platformSdk.showAd('display', { containerId: BANNER_CONTAINER_ID })
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
                container.style.display = 'none'
            })
    }

    hideBanner() {
        const container = document.getElementById(BANNER_CONTAINER_ID)
        if (container) {
            container.style.display = 'none'
        }

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial() {
        this.#currentAdvertisementIsRewarded = false

        if (this._platformSdk) {
            this._platformSdk
                .showAd()
                .catch(() => {
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                })
        } else {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
        }
    }

    showRewarded() {
        this.#currentAdvertisementIsRewarded = true

        if (this._platformSdk) {
            this._platformSdk
                .showAd('rewarded')
                .catch(() => {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                })
        } else {
            this._setRewardedState(REWARDED_STATE.FAILED)
        }
    }
}

export default GameDistributionPlatformBridge
