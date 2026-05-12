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

import eventBus, { applyEventBusMixin } from '../../lib/EventBus'
import ModuleBase from '../ModuleBase'
import analyticsModule from '../AnalyticsModule'
import { EVENT_NAME } from '../../constants'
import {
    BANNER_POSITION,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    type BannerPosition,
    type BannerState,
    type InterstitialState,
    type RewardedState,
} from './constants'
import BannerController from './BannerController'
import InterstitialController from './InterstitialController'
import RewardedController from './RewardedController'
import AdvancedBannersController from './AdvancedBannersController'
import type {
    AdvertisementBridgeContract,
    AnalyticsSender,
} from './types'
import type { EventEmitter } from '../../lib/EventBus'

interface AdvertisementModule extends EventEmitter {}

class AdvertisementModule extends ModuleBase<AdvertisementBridgeContract> {
    get isBannerSupported(): boolean {
        return this.#banner.isSupported
    }

    get bannerState(): BannerState {
        return this.#banner.state
    }

    get isInterstitialSupported(): boolean {
        return this.#interstitial.isSupported
    }

    get interstitialState(): InterstitialState {
        return this.#interstitial.state
    }

    get isRewardedSupported(): boolean {
        return this.#rewarded.isSupported
    }

    get rewardedPlacement(): string | null {
        return this.#rewarded.placement
    }

    get rewardedState(): RewardedState {
        return this.#rewarded.state
    }

    get minimumDelayBetweenInterstitial(): number {
        return this.#interstitial.minimumDelayBetweenInterstitial
    }

    get isAdvancedBannersSupported(): boolean {
        return this.#advancedBanners.isSupported
    }

    get advancedBannersState(): BannerState {
        return this.#advancedBanners.state
    }

    #banner: BannerController

    #interstitial: InterstitialController

    #rewarded: RewardedController

    #advancedBanners: AdvancedBannersController

    constructor(platformBridge: AdvertisementBridgeContract) {
        super(platformBridge)

        const analytics = analyticsModule as unknown as AnalyticsSender

        this.#banner = new BannerController(platformBridge, analytics)

        this.#interstitial = new InterstitialController(
            platformBridge,
            analytics,
            (state) => this.#onInterstitialStateChange(state),
        )

        this.#rewarded = new RewardedController(
            platformBridge,
            analytics,
            (state) => this.#onRewardedStateChange(state),
        )

        this.#advancedBanners = new AdvancedBannersController(
            platformBridge,
            analytics,
            () => this.#hasAdvertisementInProgress(),
        )

        eventBus.on(
            EVENT_NAME.PLATFORM_MESSAGE_SENT,
            (message: unknown) => this.#advancedBanners.tryShow(message as string),
        )
    }

    setMinimumDelayBetweenInterstitial(value: unknown): void {
        this.#interstitial.setMinimumDelay(value)
    }

    showBanner(position: BannerPosition = BANNER_POSITION.BOTTOM, placement: string | null = null): void {
        this.#banner.show(position, placement)
    }

    hideBanner(): void {
        this.#banner.hide()
    }

    preloadInterstitial(placement: string | null = null): void {
        this.#interstitial.preload(placement)
    }

    showInterstitial(placement: string | null = null): void {
        if (this.#hasAdvertisementInProgress()) {
            return
        }
        this.#interstitial.show(placement)
    }

    preloadRewarded(placement: string | null = null): void {
        this.#rewarded.preload(placement)
    }

    showRewarded(placement: string | null = null): void {
        if (this.#hasAdvertisementInProgress()) {
            return
        }
        this.#rewarded.show(placement)
    }

    showAdvancedBanners(placement: string | null): void {
        this.#advancedBanners.show(placement)
    }

    hideAdvancedBanners(): void {
        this.#advancedBanners.hide()
    }

    checkAdBlock(): Promise<unknown> {
        return this._platformBridge.checkAdBlock()
    }

    #hasAdvertisementInProgress(): boolean {
        return this.#interstitial.isInProgress || this.#rewarded.isInProgress
    }

    #onInterstitialStateChange(state: InterstitialState): void {
        if (state === INTERSTITIAL_STATE.LOADING || state === INTERSTITIAL_STATE.OPENED) {
            this.#advancedBanners.hideByAd()
        } else if (state === INTERSTITIAL_STATE.CLOSED || state === INTERSTITIAL_STATE.FAILED) {
            this.#advancedBanners.restoreAfterAd()
        }
    }

    #onRewardedStateChange(state: RewardedState): void {
        if (state === REWARDED_STATE.LOADING || state === REWARDED_STATE.OPENED) {
            this.#advancedBanners.hideByAd()
        } else if (state === REWARDED_STATE.CLOSED || state === REWARDED_STATE.FAILED) {
            this.#advancedBanners.restoreAfterAd()
        }
    }
}

applyEventBusMixin(AdvertisementModule.prototype)
export default AdvertisementModule
