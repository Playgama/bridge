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

import { applyLocalEventMixin } from '../lib/EventBus'
import {
    EVENT_NAME,
    BridgeError,
    ERROR_CODE,
    MODULE_NAME,
    type LaunchSource,
} from '../constants'
import { serverTimeCache } from '../lib/serverTime'
import { resolveApiOrigin } from '../lib/apiOrigin'
import {
    PLATFORM_ID,
    VISIBILITY_STATE,
    type PlatformId,
    type VisibilityState,
} from '../modules/platform/constants'
import {
    DEVICE_TYPE,
    DEVICE_OS,
    type DeviceType,
    type DeviceOs,
} from '../modules/device/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../modules/advertisement/constants'
import { LEADERBOARD_TYPE, type LeaderboardType } from '../modules/leaderboards/constants'
import type { NormalizedAchievement } from '../modules/achievements/types'
import { internalAnalytics } from '../modules/analytics'
import {
    getPaymentsProductsPlatformData,
    getPaymentsProductPlatformData,
    generatePaymentsTransactionId,
} from '../modules/payments'
import Deferred from '../lib/Deferred'
import StateAggregator from '../lib/StateAggregator'
import type { AnyRecord } from '../utils'
import { showInfoPopup, showAdFailurePopup } from '../modules/advertisement'
import { getGuestUser } from '../modules/player'
import bridgeConfig, { type ConfigFileOptions } from '../lib/bridge-config'
import type { EventEmitter } from '../lib/EventBus'

type AggregationStateKey = 'interstitial' | 'rewarded' | 'visibility' | 'platform' | 'rate'

interface PlatformBridgeBase extends EventEmitter {}

class PlatformBridgeBase {
    get options(): ConfigFileOptions {
        return this._options
    }

    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.MOCK
    }

    // Origin of the Playgama backend for this platform. Defaults to the public
    // API host; platforms served through a proxy (e.g. Discord's URL mapping)
    // resolve to a relative prefix. Consumers build URLs as `${apiOrigin}${path}`.
    get apiOrigin(): string {
        return resolveApiOrigin(this.platformId)
    }

    get platformSdk(): unknown {
        return this._platformSdk
    }

    get additionalData(): Record<string, unknown> {
        return this._additionalData ?? {}
    }

    get platformLanguage(): string {
        const value = navigator.language
        if (typeof value === 'string') {
            return value.substring(0, 2).toLowerCase()
        }

        return 'en'
    }

    get platformPayload(): string | null {
        const url = new URL(window.location.href)
        return url.searchParams.get('payload')
    }

    get platformTld(): string | null {
        return null
    }

    get launchSource(): LaunchSource | null {
        return null
    }

    get isPlatformGamesListSupported(): boolean {
        return false
    }

    get isPlatformExternalCallsSupported(): boolean {
        return true
    }

    get isPlatformAudioEnabled(): boolean {
        if (this._audioStateAggregator) {
            return !this._audioStateAggregator.getAggregatedState()
        }

        return true
    }

    get isPlatformPaused(): boolean {
        if (this._pauseStateAggregator) {
            return this._pauseStateAggregator.getAggregatedState()
        }

        return false
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return false
    }

    get isPlayerAuthorized(): boolean {
        return this._isPlayerAuthorized
    }

    get playerId(): string | null {
        return this._playerId
    }

    get playerName(): string | null {
        return this._playerName
    }

    get playerPhotos(): string[] {
        return this._playerPhotos
    }

    get playerExtra(): Record<string, unknown> {
        return this._playerExtra
    }

    // storage
    get isPlatformStorageAvailable(): boolean {
        return this._isPlatformStorageAvailable
    }

    // advertisement
    get isBannerSupported(): boolean {
        return this._isBannerSupported
    }

    get isAdvancedBannersSupported(): boolean {
        return this._isAdvancedBannersSupported
    }

    get isInterstitialSupported(): boolean {
        return false
    }

    get isMinimumDelayBetweenInterstitialEnabled(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 60
    }

    get isRewardedSupported(): boolean {
        return false
    }

    // social
    get isInviteFriendsSupported(): boolean {
        return false
    }

    get isJoinCommunitySupported(): boolean {
        return false
    }

    get isShareSupported(): boolean {
        return false
    }

    get isCreatePostSupported(): boolean {
        return false
    }

    get isAddToHomeScreenSupported(): boolean {
        return false
    }

    get isAddToHomeScreenRewardSupported(): boolean {
        return false
    }

    get isAddToFavoritesSupported(): boolean {
        return false
    }

    get isAddToFavoritesRewardSupported(): boolean {
        return false
    }

    get isRateSupported(): boolean {
        return false
    }

    get isPlatformExternalLinksAllowed(): boolean {
        return true
    }

    // device
    get deviceType(): DeviceType {
        if (navigator && navigator.userAgent) {
            const userAgent = navigator.userAgent.toLowerCase()
            if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
                return DEVICE_TYPE.MOBILE
            }

            if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP)))/.test(userAgent)) {
                return DEVICE_TYPE.TABLET
            }
        }

        return DEVICE_TYPE.DESKTOP
    }

    get deviceOs(): DeviceOs {
        const ua = navigator?.userAgent ?? ''

        if (/android/i.test(ua)) {
            return DEVICE_OS.ANDROID
        }

        if (/iphone|ipod|ipad/i.test(ua)
            || (navigator?.platform === 'MacIntel' && navigator?.maxTouchPoints > 1)) {
            return DEVICE_OS.IOS
        }

        if (/windows/i.test(ua)) {
            return DEVICE_OS.WINDOWS
        }

        if (/macintosh|mac os/i.test(ua)) {
            return DEVICE_OS.MACOS
        }

        if (/linux/i.test(ua)) {
            return DEVICE_OS.LINUX
        }

        return DEVICE_OS.OTHER
    }

    // payments
    get isPaymentsSupported(): boolean {
        return false
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NOT_AVAILABLE
    }

    // config
    get isRemoteConfigSupported(): boolean {
        return false
    }

    // clipboard
    get isClipboardSupported(): boolean {
        return true
    }

    // achievements
    get isAchievementsSupported(): boolean {
        return false
    }

    protected _options!: ConfigFileOptions

    protected _additionalData: Record<string, unknown> | null = null

    protected _isInitialized = false

    protected _platformSdk: unknown = null

    protected _isPlayerAuthorized = false

    protected _playerId: string | null = null

    protected _playerName: string | null = null

    protected _playerPhotos: string[] = []

    protected _playerExtra: Record<string, unknown> = {}

    protected _visibilityState: VisibilityState | null = null

    protected _isPlatformStorageAvailable = false

    protected _isBannerSupported = false

    protected _isAdvancedBannersSupported = false

    protected _useAdvertisementErrorPopup = false

    protected _paymentsPurchases: Array<AnyRecord & { id: string }> = []

    protected _pauseStateAggregator: StateAggregator<AggregationStateKey> | null = null

    protected _audioStateAggregator: StateAggregator<AggregationStateKey> | null = null

    // Helper methods keep the `PromiseDecorator` naming for backward-compatible subclass API.
    #promiseDecorators: Record<string, Deferred<unknown>> = {}

    #lastAdFailurePopupTime = 0

    constructor() {
        this._playerApplyGuestData()

        this._visibilityState = document.visibilityState

        const aggregationStates: AggregationStateKey[] = ['interstitial', 'rewarded', 'visibility', 'platform', 'rate']
        this._pauseStateAggregator = new StateAggregator<AggregationStateKey>(
            aggregationStates,
            (isPaused) => this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, isPaused),
        )

        this._audioStateAggregator = new StateAggregator<AggregationStateKey>(
            aggregationStates,
            (isDisabled) => this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, !isDisabled),
        )

        document.addEventListener('visibilitychange', () => {
            this._setVisibilityState(document.visibilityState as VisibilityState)
        })

        window.addEventListener('blur', () => {
            this._setVisibilityState(VISIBILITY_STATE.HIDDEN)
        })

        window.addEventListener('focus', () => {
            this._setVisibilityState(VISIBILITY_STATE.VISIBLE)
        })

        this._options = bridgeConfig.getValues()
    }

    initialize(): Promise<unknown> {
        return Promise.resolve()
    }

    // platform
    sendMessage(_message?: unknown, _options?: unknown): Promise<unknown> {
        return Promise.resolve()
    }

    sendCustomMessage(_id?: unknown, _options?: unknown): Promise<unknown> {
        return Promise.resolve()
    }

    getServerTime(): Promise<number> {
        return serverTimeCache.getServerTime(this.apiOrigin)
    }

    // Returns the platform games catalog as a flat array of detailed games.
    // Platforms that expose a catalog (isPlatformGamesListSupported) override this.
    getGamesList(): Promise<unknown[]> {
        return Promise.resolve([])
    }

    // cloud storage — each platform that supports it implements these three methods itself
    getDataFromStorage(_keys: string[]): Promise<Record<string, unknown>> {
        return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
    }

    setDataToStorage(_data: Record<string, unknown>): Promise<void> {
        return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
    }

    deleteDataFromStorage(_keys: string[]): Promise<void> {
        return Promise.reject(new BridgeError(ERROR_CODE.STORAGE_NOT_SUPPORTED))
    }

    // advertisement
    showBanner(_position?: unknown, _placement?: unknown): void {
        this._setBannerState(BANNER_STATE.FAILED)
    }

    hideBanner(): void {
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showAdvancedBanners(_banners?: unknown): void { }

    hideAdvancedBanners(): void { }

    preloadInterstitial(_placement?: unknown): void { }

    showInterstitial(_placement?: unknown): void {
        this._showAdFailurePopup(false)
    }

    preloadRewarded(_placement?: unknown): void { }

    showRewarded(_placement?: unknown): void {
        this._showAdFailurePopup(true)
    }

    checkAdBlock(): Promise<boolean> {
        const fakeAd = document.createElement('div')
        fakeAd.className = 'textads banner-ads banner_ads ad-unit ad-zone ad-space adsbox'
        fakeAd.style.position = 'absolute'
        fakeAd.style.left = '-9999px'
        fakeAd.style.width = '1px'
        fakeAd.style.height = '1px'
        document.body.appendChild(fakeAd)

        const REQUEST_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

        const REQUEST_CONFIG: RequestInit = {
            method: 'HEAD',
            mode: 'no-cors',
        }

        return new Promise((resolve) => {
            fetch(REQUEST_URL, REQUEST_CONFIG)
                .then((response) => {
                    if (response.redirected) {
                        resolve(response.redirected)
                    } else {
                        window.setTimeout(() => {
                            const result = fakeAd.offsetHeight === 0 || window.getComputedStyle(fakeAd)?.display === 'none'
                            resolve(result)
                            fakeAd.remove()
                        }, 100)
                    }
                })
                .catch(() => {
                    resolve(true)
                })
        })
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
        const purchase = { id }
        this._paymentsPurchases.push(purchase)
        return Promise.resolve(purchase)
    }

    paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        this._paymentsPurchases.splice(purchaseIndex, 1)
        return Promise.resolve({ id })
    }

    paymentsGetCatalog(): Promise<unknown> {
        return Promise.resolve(this._paymentsGetProductsPlatformData())
    }

    paymentsGetPurchases(): Promise<unknown> {
        return Promise.resolve(this._paymentsPurchases)
    }

    // clipboard
    clipboardRead(): Promise<string> {
        if (window.navigator && window.navigator.clipboard) {
            return window.navigator.clipboard.readText()
        }

        return Promise.reject()
    }

    clipboardWrite(text: string): Promise<void> {
        if (window.navigator && window.navigator.clipboard) {
            return window.navigator.clipboard.writeText(text)
        }

        return Promise.reject()
    }

    // achievements
    achievementsUnlock(_data?: unknown): Promise<unknown> {
        return Promise.reject()
    }

    achievementsGetList(): Promise<NormalizedAchievement[]> {
        return Promise.reject()
    }

    protected _setPlatformStorageAvailable(isAvailable: boolean): void {
        if (this._isPlatformStorageAvailable === isAvailable) {
            return
        }

        this._isPlatformStorageAvailable = isAvailable
        this.emit(EVENT_NAME.PLATFORM_STORAGE_AVAILABILITY_CHANGED, isAvailable)
    }

    protected _setVisibilityState(state: VisibilityState): void {
        if (this._visibilityState === state) {
            return
        }

        this._visibilityState = state

        const isHidden = state === VISIBILITY_STATE.HIDDEN
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('visibility', isHidden)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('visibility', isHidden)
        }
    }

    protected _setBannerState(state: string): void {
        this.emit(EVENT_NAME.BANNER_STATE_CHANGED, state)
    }

    protected _setAdvancedBannersState(state: string): void {
        this.emit(EVENT_NAME.ADVANCED_BANNERS_STATE_CHANGED, state)
    }

    protected _setInterstitialState(state: string): void {
        this.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, state)

        const isActive = state === INTERSTITIAL_STATE.OPENED
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('interstitial', isActive)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('interstitial', isActive)
        }
    }

    protected _setRewardedState(state: string): void {
        this.emit(EVENT_NAME.REWARDED_STATE_CHANGED, state)

        const isActive = state === REWARDED_STATE.OPENED || state === REWARDED_STATE.REWARDED
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('rewarded', isActive)
        }

        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('rewarded', isActive)
        }
    }

    protected _setAudioState(isEnabled: boolean): void {
        if (this._audioStateAggregator) {
            this._audioStateAggregator.setState('platform', !isEnabled)
        } else {
            this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled)
        }
    }

    protected _setPauseState(isPaused: boolean): void {
        if (this._pauseStateAggregator) {
            this._pauseStateAggregator.setState('platform', isPaused)
        } else {
            this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, isPaused)
        }
    }

    protected _createPromiseDecorator<T = unknown>(actionName: string): Deferred<T> {
        const promiseDecorator = new Deferred<T>()
        this.#promiseDecorators[actionName] = promiseDecorator as Deferred<unknown>
        return promiseDecorator
    }

    protected _getPromiseDecorator<T = unknown>(actionName: string): Deferred<T> | undefined {
        return this.#promiseDecorators[actionName] as Deferred<T> | undefined
    }

    protected _resolvePromiseDecorator(id: string, data?: unknown): void {
        if (this.#promiseDecorators[id]) {
            this.#promiseDecorators[id].resolve(data)
            delete this.#promiseDecorators[id]
        }
    }

    protected _rejectPromiseDecorator(id: string, error?: unknown): void {
        if (this.#promiseDecorators[id]) {
            this.#promiseDecorators[id].reject(error)
            delete this.#promiseDecorators[id]
        }
    }

    protected _paymentsGetProductsPlatformData(): AnyRecord[] {
        return getPaymentsProductsPlatformData(this._options.payments, this.platformId)
    }

    protected _paymentsGetProductPlatformData(id: string): AnyRecord | null {
        return getPaymentsProductPlatformData(this._options.payments, this.platformId, id)
    }

    protected _paymentsGenerateTransactionId(id: string): string {
        return generatePaymentsTransactionId(id)
    }

    protected _advertisementShowErrorPopup(isRewarded: boolean): Promise<void> {
        const useBuiltInErrorPopup = this._options?.advertisement?.useBuiltInErrorPopup
        if (useBuiltInErrorPopup) {
            return showInfoPopup('Oops! It looks like you closed the ad too early, or it isn\'t available right now.')
                .then(() => {
                    if (isRewarded) {
                        this._setRewardedState(REWARDED_STATE.FAILED)
                    } else {
                        this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                    }
                })
        }

        if (isRewarded) {
            this._setRewardedState(REWARDED_STATE.FAILED)
        } else {
            this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
        }

        return Promise.resolve()
    }

    protected _showAdFailurePopup(isRewarded: boolean): Promise<void> {
        const showPopup = this._options?.advertisement?.useAdvertisementErrorPopup ?? this._useAdvertisementErrorPopup

        if (!showPopup) {
            if (isRewarded) {
                this._setRewardedState(REWARDED_STATE.FAILED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            }

            return Promise.resolve()
        }

        if (!isRewarded) {
            const cooldown = this._options?.advertisement?.builtInErrorPopupCooldown ?? 180
            const now = Date.now()
            const elapsedSeconds = (now - this.#lastAdFailurePopupTime) / 1000

            if (elapsedSeconds < cooldown) {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                return Promise.resolve()
            }

            this.#lastAdFailurePopupTime = now
        }

        if (isRewarded) {
            this._setRewardedState(REWARDED_STATE.OPENED)
            internalAnalytics.send(
                `${MODULE_NAME.ADVERTISEMENT}_rewarded_fallback_opened`,
            )
        } else {
            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            internalAnalytics.send(
                `${MODULE_NAME.ADVERTISEMENT}_interstitial_fallback_opened`,
            )
        }

        return showAdFailurePopup().then(() => {
            if (isRewarded) {
                internalAnalytics.send(
                    `${MODULE_NAME.ADVERTISEMENT}_rewarded_fallback_closed`,
                )
                this._setRewardedState(REWARDED_STATE.FAILED)
            } else {
                internalAnalytics.send(
                    `${MODULE_NAME.ADVERTISEMENT}_interstitial_fallback_closed`,
                )
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            }
        })
    }

    protected _playerApplyGuestData(): void {
        const guest = getGuestUser()
        this._playerId = guest.id
        this._playerName = guest.name
    }
}

applyLocalEventMixin(PlatformBridgeBase.prototype)
export default PlatformBridgeBase
