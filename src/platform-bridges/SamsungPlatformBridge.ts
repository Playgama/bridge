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
import { addJavaScript, waitFor, type AnyRecord } from '../utils'
import logger from '../lib/logger'
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import { INTERSTITIAL_STATE, REWARDED_STATE } from '../modules/advertisement/constants'

const SDK_URL = 'https://gtg.samsungapps.com/gsinstant-sdk/gsinstant.0.45.js'

interface SamsungResult {
    err?: unknown
    result?: string
    [key: string]: unknown
}

interface SamsungAds {
    initAd(options: AnyRecord): SamsungResult | void
    loadAd(options: { adFormat: string }): SamsungResult | void
    showAd(options: { adFormat: string }): SamsungResult | void
    addEventListener(event: string, callback: () => void): void
}

interface GSInstantSdk {
    initializeAsync(): Promise<SamsungResult | void>
    getLocale(): string
    canCreateShortCut(): SamsungResult | boolean
    setOnPauseCallback(callback: () => void): void
    setOnResumeCallback(callback: () => void): void
    startGameAsync(): Promise<SamsungResult | void>
    getLoginStatus(): SamsungResult
    loginAsync(): Promise<unknown>
    player: { getPlayerIdAsync(): Promise<string> }
    getDataAsync(keys: string[]): Promise<Record<string, unknown>>
    setDataAsync(data: Record<string, unknown>): Promise<unknown>
    createShortCut(): SamsungResult | void
    advertisement2?: SamsungAds
}

declare global {
    interface Window {
        GSInstant?: GSInstantSdk
    }
}

function getResultError(result: SamsungResult | boolean | void): unknown {
    if (result && typeof result === 'object') {
        return result.err
    }
    return undefined
}

class SamsungPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.SAMSUNG
    }

    get platformLanguage(): string {
        return this.#platformLanguage || super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isAddToHomeScreenSupported(): boolean {
        return this.#canCreateShortCut
    }

    get isExternalLinksAllowed(): boolean {
        return false
    }

    #platformLanguage: string | null = null

    #canCreateShortCut = false

    #isAdInitialized = false

    #currentAdIsRewarded = false

    #isAdShowing = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const loadSdk = typeof window.GSInstant !== 'undefined'
                ? Promise.resolve()
                : addJavaScript(SDK_URL)

            loadSdk
                .then(() => waitFor('GSInstant'))
                .then(() => {
                    this._platformSdk = window.GSInstant as GSInstantSdk
                    return (this._platformSdk as GSInstantSdk).initializeAsync()
                })
                .then((result) => {
                    if (getResultError(result)) {
                        throw new Error(`Samsung initializeAsync failed: ${getResultError(result)}`)
                    }

                    const sdk = this._platformSdk as GSInstantSdk

                    const locale = sdk.getLocale()
                    if (typeof locale === 'string' && locale.length >= 2) {
                        this.#platformLanguage = locale.substring(0, 2).toLowerCase()
                    }

                    const shortcutCheck = sdk.canCreateShortCut()
                    this.#canCreateShortCut = Boolean(shortcutCheck) && !getResultError(shortcutCheck)

                    sdk.setOnPauseCallback(() => {
                        this._setPauseState(true)
                    })

                    sdk.setOnResumeCallback(() => {
                        this._setPauseState(false)
                    })

                    return this.#fetchPlayerData()
                })
                .then(() => {
                    this.#initializeAds()
                    return (this._platformSdk as GSInstantSdk).startGameAsync()
                })
                .then((result) => {
                    if (getResultError(result)) {
                        throw new Error(`Samsung startGameAsync failed: ${getResultError(result)}`)
                    }

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer(): Promise<unknown> {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            const sdk = this._platformSdk as GSInstantSdk
            sdk.loginAsync()
                .catch((error) => {
                    // Samsung rejects with {err: 'ALREADY_LOGGED_IN'} when the session
                    // is already authenticated — treat as success and proceed to fetch playerId.
                    if (error && (error as SamsungResult).err === 'ALREADY_LOGGED_IN') {
                        return undefined
                    }
                    throw error
                })
                .then(() => sdk.player.getPlayerIdAsync())
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._setPlatformStorageAvailable(true)
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
                .catch((error: unknown) => {
                    // Samsung loginAsync rejects with {err: '...'} objects;
                    // getPlayerIdAsync rejects with raw strings. Normalize to Error.
                    const message = (error && (error as SamsungResult).err)
                        || (typeof error === 'string' ? error : 'samsung_auth_failed')
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, new Error(String(message)))
                })
        }

        return promiseDecorator.promise
    }

    // storage
    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        const result: Record<string, unknown> = {}
        await Promise.all(keys.map(async (key) => {
            const data = await (this._platformSdk as GSInstantSdk).getDataAsync([key])
            const value = data && data[key] !== undefined ? data[key] : null
            if (value !== null && value !== undefined && value !== '') {
                // The SDK may hand back a deserialized object; the cache holds serialized strings.
                result[key] = typeof value === 'string' ? value : JSON.stringify(value)
            }
        }))
        return result
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(Object.keys(data)
            .map((key) => (this._platformSdk as GSInstantSdk).setDataAsync({ [key]: data[key] as string })))
            .then(() => undefined)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(keys.map((key) => (this._platformSdk as GSInstantSdk).setDataAsync({ [key]: null })))
            .then(() => undefined)
    }

    // advertisement
    preloadInterstitial(): void {
        if (!this.#isAdInitialized) {
            return
        }

        const result = (this._platformSdk as GSInstantSdk).advertisement2!.loadAd({ adFormat: 'INTERSTITIAL' })
        if (getResultError(result)) {
            logger.warn('Samsung loadAd(INTERSTITIAL) error:', getResultError(result))
        }
    }

    showInterstitial(): void {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(false)
            return
        }

        this.#currentAdIsRewarded = false
        this.#isAdShowing = true
        const result = (this._platformSdk as GSInstantSdk).advertisement2!.showAd({ adFormat: 'INTERSTITIAL' })
        if (getResultError(result)) {
            logger.warn('Samsung showAd(INTERSTITIAL) error:', getResultError(result))
            this.#isAdShowing = false
            this._showAdFailurePopup(false)
        }
    }

    preloadRewarded(): void {
        if (!this.#isAdInitialized) {
            return
        }

        const result = (this._platformSdk as GSInstantSdk).advertisement2!.loadAd({ adFormat: 'REWARD' })
        if (getResultError(result)) {
            logger.warn('Samsung loadAd(REWARD) error:', getResultError(result))
        }
    }

    showRewarded(): void {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(true)
            return
        }

        this.#currentAdIsRewarded = true
        this.#isAdShowing = true
        const result = (this._platformSdk as GSInstantSdk).advertisement2!.showAd({ adFormat: 'REWARD' })
        if (getResultError(result)) {
            logger.warn('Samsung showAd(REWARD) error:', getResultError(result))
            this.#isAdShowing = false
            this._showAdFailurePopup(true)
        }
    }

    // social
    addToHomeScreen(): Promise<void> {
        const result = (this._platformSdk as GSInstantSdk).createShortCut()
        const err = getResultError(result)
        if (err) {
            return Promise.reject(new Error(String(err)))
        }

        return Promise.resolve()
    }

    #ensureStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    #fetchPlayerData(): Promise<void> {
        const sdk = this._platformSdk as GSInstantSdk
        const loginStatus = sdk.getLoginStatus()
        if (loginStatus && !loginStatus.err && loginStatus.result === 'LOGIN') {
            return sdk.player.getPlayerIdAsync()
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._setPlatformStorageAvailable(true)
                })
                .catch(() => {
                    this._isPlayerAuthorized = false
                    this._playerApplyGuestData()
                })
        }

        this._isPlayerAuthorized = false
        this._playerApplyGuestData()
        return Promise.resolve()
    }

    #initializeAds(): void {
        const ads = (this._platformSdk as GSInstantSdk).advertisement2
        if (!ads || typeof ads.initAd !== 'function') {
            logger.warn('Samsung advertisement2 API not available on this Galaxy Store Client')
            return
        }

        const options = this._options as AnyRecord
        const adOptions: AnyRecord = {}

        const interstitialPlacement = this.#resolveSamsungPlacement('interstitial')
        if (interstitialPlacement) {
            adOptions.samsungInterstitialAdPlacementId = interstitialPlacement
        }

        const rewardedPlacement = this.#resolveSamsungPlacement('rewarded')
        if (rewardedPlacement) {
            adOptions.samsungRewardedAdPlacementId = rewardedPlacement
        }

        if (options.admobInterstitialAdUnitId) {
            adOptions.admobInterstitialAdUnitId = options.admobInterstitialAdUnitId
        }
        if (options.admobRewardedAdUnitId) {
            adOptions.admobRewardedAdUnitId = options.admobRewardedAdUnitId
        }
        if (options.gameTitle) {
            adOptions.gameTitle = options.gameTitle
        }

        if (Object.keys(adOptions).length === 0) {
            return
        }

        const result = ads.initAd(adOptions)
        if (getResultError(result)) {
            logger.warn('Samsung ad init error:', getResultError(result))
            return
        }

        this.#isAdInitialized = true

        ads.addEventListener('AD_START', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        })

        ads.addEventListener('AD_COMPLETE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_SKIP', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_CLOSE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_LOAD_ERROR', () => {
            // Preload failures fire here before any show call — stay silent.
            // Only surface as a failure if the game already requested a show.
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_SHOW_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_VIDEO_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })
    }

    #resolveSamsungPlacement(adType: string): string | null {
        const advertisement = (this._options as AnyRecord).advertisement as AnyRecord | undefined
        const adConfig = advertisement?.[adType] as AnyRecord | undefined
        const placements = adConfig?.placements as AnyRecord[] | undefined
        if (!Array.isArray(placements) || placements.length === 0) {
            return null
        }

        const fallbackId = adConfig?.placementFallback
        if (fallbackId) {
            const match = placements.find((p) => p.id === fallbackId)
            if (match?.[PLATFORM_ID.SAMSUNG]) {
                return match[PLATFORM_ID.SAMSUNG] as string
            }
        }

        const firstWithSamsung = placements.find((p) => p[PLATFORM_ID.SAMSUNG])
        return (firstWithSamsung?.[PLATFORM_ID.SAMSUNG] as string) ?? null
    }
}

export default SamsungPlatformBridge
