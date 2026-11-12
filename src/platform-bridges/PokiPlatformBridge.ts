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
import { addJavaScript, waitFor } from '../utils'
import { ACTION_NAME } from '../constants'
import logger from '../lib/logger'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    type PlatformId,
} from '../modules/platform/constants'
import type { PlatformMessageOptions } from '../modules/platform/PlatformModule'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
} from '../modules/advertisement/constants'

const SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js'
const MEASURE_CUSTOM_CATEGORY = 'custom'
const MEASURE_CUSTOM_ACTION = 'trigger'
// Poki reserves '/' and '^' in measure values
const MEASURE_RESERVED_CHARS = /[/^]/g
const MEASURE_RESERVED_CHARS_REPLACEMENT = '-'
const MEASURE_LEVEL_CATEGORY = 'level'
const MEASURE_LEVEL_ACTIONS: Record<string, string> = {
    [PLATFORM_MESSAGE.LEVEL_STARTED]: 'start',
    [PLATFORM_MESSAGE.LEVEL_COMPLETED]: 'complete',
    [PLATFORM_MESSAGE.LEVEL_FAILED]: 'fail',
}

interface PokiSdk {
    init(): Promise<unknown>
    gameLoadingFinished(): void
    gameplayStart(): void
    gameplayStop(): void
    commercialBreak(onStart: () => void): Promise<unknown>
    rewardedBreak(onStart: () => void): Promise<boolean>
    measure(category: string, what: string, action: string): void
}

interface PokiMeasureOptions {
    category?: unknown
    what?: unknown
    action?: unknown
}

declare global {
    interface Window {
        PokiSDK?: PokiSdk
    }
}

class PokiPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.POKI
    }

    get isPlatformExternalCallsSupported(): boolean {
        return false
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    // clipboard
    get isClipboardSupported(): boolean {
        return false
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('PokiSDK', 'init'))
                .then(() => {
                    this._platformSdk = window.PokiSDK as PokiSdk
                    const onReady = () => {
                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    };
                    // init() rejects when an ad blocker is active, but the SDK keeps working,
                    // so the game starts anyway (as Poki's own guide does).
                    (this._platformSdk as PokiSdk).init().then(onReady, (error) => {
                        logger.warn('PokiSDK.init() failed, continuing:', error)
                        onReady()
                    })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown, options?: PlatformMessageOptions): Promise<unknown> {
        const sdk = this._platformSdk as PokiSdk
        this.#measureLevel(message, options)

        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                sdk.gameLoadingFinished()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED:
            case PLATFORM_MESSAGE.LEVEL_STARTED:
            case PLATFORM_MESSAGE.LEVEL_RESUMED: {
                sdk.gameplayStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED:
            case PLATFORM_MESSAGE.LEVEL_PAUSED:
            case PLATFORM_MESSAGE.LEVEL_COMPLETED:
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                sdk.gameplayStop()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    sendCustomMessage(id?: unknown, options?: unknown): Promise<unknown> {
        const { category, what, action } = (options ?? {}) as PokiMeasureOptions
        this.#measure(
            category ?? MEASURE_CUSTOM_CATEGORY,
            what ?? id,
            action ?? MEASURE_CUSTOM_ACTION,
        )
        return Promise.resolve()
    }

    // advertisement
    showInterstitial(): void {
        let isInterstitialOpened = false;
        (this._platformSdk as PokiSdk).commercialBreak(() => {
            isInterstitialOpened = true
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
        })
            .then(() => {
                if (isInterstitialOpened) {
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                } else {
                    this._showAdFailurePopup(false)
                }
            })
            .catch(() => {
                this._showAdFailurePopup(false)
            })
    }

    showRewarded(): void {
        let isRewardedOpened = false;
        (this._platformSdk as PokiSdk).rewardedBreak(() => {
            isRewardedOpened = true
            this._setRewardedState(REWARDED_STATE.OPENED)
        })
            .then((success) => {
                if (isRewardedOpened) {
                    if (success) {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    }

                    this._setRewardedState(REWARDED_STATE.CLOSED)
                } else {
                    this._showAdFailurePopup(true)
                }
            })
            .catch(() => {
                this._showAdFailurePopup(true)
            })
    }

    #measureLevel(message: unknown, options?: PlatformMessageOptions): void {
        const action = MEASURE_LEVEL_ACTIONS[message as string]
        if (!action || options?.level === undefined) {
            return
        }

        const level = String(options.level)
        const what = options.world === undefined ? level : `${String(options.world)}-${level}`
        this.#measure(MEASURE_LEVEL_CATEGORY, what, action)
    }

    #measure(category: unknown, what: unknown, action: unknown): void {
        const sdk = this._platformSdk as PokiSdk
        const sanitize = (value: unknown) => String(value)
            .replace(MEASURE_RESERVED_CHARS, MEASURE_RESERVED_CHARS_REPLACEMENT)

        sdk.measure(sanitize(category), sanitize(what), sanitize(action))
    }
}

export default PokiPlatformBridge
