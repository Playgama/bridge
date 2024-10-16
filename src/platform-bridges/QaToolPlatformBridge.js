/*
 * This file is part of Playgama Bridge.
 *
 * Playgama Bridge is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Playgama Bridge is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Playgama Bridge. If not, see <https://www.gnu.org/licenses/>.
 */

import PlatformBridgeBase from './PlatformBridgeBase'
import {
    PLATFORM_ID,
    ACTION_NAME,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../constants'

const QA_TOOL_VERSION = '1.0.0'

class QaToolPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.QA_TOOL
    }

    // social
    get isExternalLinksAllowed() {
        return false
    }

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            this._isInitialized = true
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)

            window.parent.postMessage({
                type: 'liveness',
                action: 'ping',
            }, '*')

            window.parent.postMessage({
                type: 'getQaToolVersion',
                action: QA_TOOL_VERSION,
            }, '*')
        }

        return promiseDecorator.promise
    }

    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                window.parent.postMessage({
                    type: 'platformMessage',
                    action: PLATFORM_MESSAGE.GAME_READY,
                }, '*')
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    showInterstitial() {
        const showInterstitialHandler = ({ data }) => {
            if (data?.type !== 'adv') {
                return
            }

            switch (data.payload.status) {
                case 'start':
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case 'show':
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case 'close':
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    window.removeEventListener('message', showInterstitialHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showInterstitialHandler)
        window.parent.postMessage({ type: 'adv', action: 'showInterstitial' }, '*')
    }

    showRewarded() {
        const showRewardedHandler = ({ data }) => {
            if (data?.type !== 'adv') {
                return
            }

            switch (data.payload.status) {
                case 'show':
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    break
                case 'rewarded':
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    break
                case 'close':
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    window.removeEventListener('message', showRewardedHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showRewardedHandler)
        window.parent.postMessage({ type: 'adv', action: 'showRewarded' }, '*')
    }
}

export default QaToolPlatformBridge
