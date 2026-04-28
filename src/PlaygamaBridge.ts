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

import {
    PLATFORM_ID,
    MODULE_NAME,
    EVENT_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    VISIBILITY_STATE,
    DEVICE_TYPE,
    DEVICE_ORIENTATION,
    PLATFORM_MESSAGE,
    ERROR,
    type PlatformId,
} from './constants'

import { applyEventBusMixin } from './common/EventBus'
import PromiseDecorator from './common/PromiseDecorator'
import configFileModule from './modules/ConfigFileModule'
import PlatformModule from './modules/PlatformModule'
import PlayerModule from './modules/PlayerModule'
import GameModule from './modules/GameModule'
import StorageModule from './modules/StorageModule'
import AdvertisementModule from './modules/AdvertisementModule'
import SocialModule from './modules/SocialModule'
import DeviceModule from './modules/DeviceModule'
import LeaderboardsModule from './modules/LeaderboardsModule'
import LeaderboardsSaasModule from './modules/LeaderboardsSaasModule'
import PaymentsModule from './modules/PaymentsModule'
import RemoteConfigModule from './modules/RemoteConfigModule'
import ClipboardModule from './modules/ClipboardModule'
import AchievementsModule from './modules/AchievementsModule'
import analyticsModule from './modules/AnalyticsModule'
import { fetchPlatformBridge } from './platformImports'
import type PlatformBridgeBase from './platform-bridges/PlatformBridgeBase'
import type { EventEmitter } from './types/common'

interface AnalyticsModuleLike {
    send(eventType: string, data?: Record<string, unknown>): void
    initialize(bridge: unknown): unknown
}

export interface PlaygamaInitOptions {
    configFilePath?: string
    [key: string]: unknown
}

interface PlaygamaBridge extends EventEmitter {}

class PlaygamaBridge {
    get version(): string {
        return PLUGIN_VERSION
    }

    get isInitialized(): boolean {
        return this.#isInitialized
    }

    get options(): unknown {
        return this.#platformBridge?.options
    }

    get platform(): unknown {
        return this.#getModule(MODULE_NAME.PLATFORM)
    }

    get player(): unknown {
        return this.#getModule(MODULE_NAME.PLAYER)
    }

    get game(): unknown {
        return this.#getModule(MODULE_NAME.GAME)
    }

    get storage(): unknown {
        return this.#getModule(MODULE_NAME.STORAGE)
    }

    get advertisement(): unknown {
        return this.#getModule(MODULE_NAME.ADVERTISEMENT)
    }

    get social(): unknown {
        return this.#getModule(MODULE_NAME.SOCIAL)
    }

    get device(): unknown {
        return this.#getModule(MODULE_NAME.DEVICE)
    }

    get leaderboard(): unknown {
        return this.#getModule(MODULE_NAME.LEADERBOARDS)
    }

    get leaderboards(): unknown {
        return this.#getModule(MODULE_NAME.LEADERBOARDS)
    }

    get payments(): unknown {
        return this.#getModule(MODULE_NAME.PAYMENTS)
    }

    get achievements(): unknown {
        return this.#getModule(MODULE_NAME.ACHIEVEMENTS)
    }

    get remoteConfig(): unknown {
        return this.#getModule(MODULE_NAME.REMOTE_CONFIG)
    }

    get clipboard(): unknown {
        return this.#getModule(MODULE_NAME.CLIPBOARD)
    }

    get analytics(): unknown {
        return this.#getModule(MODULE_NAME.ANALYTICS)
    }

    get engine(): string {
        return this.#engine
    }

    set engine(value: string) {
        this.#engine = value
    }

    get PLATFORM_ID(): typeof PLATFORM_ID {
        return PLATFORM_ID
    }

    get PLATFORM_MESSAGE(): typeof PLATFORM_MESSAGE {
        return PLATFORM_MESSAGE
    }

    get MODULE_NAME(): typeof MODULE_NAME {
        return MODULE_NAME
    }

    get EVENT_NAME(): typeof EVENT_NAME {
        return EVENT_NAME
    }

    get INTERSTITIAL_STATE(): typeof INTERSTITIAL_STATE {
        return INTERSTITIAL_STATE
    }

    get REWARDED_STATE(): typeof REWARDED_STATE {
        return REWARDED_STATE
    }

    get BANNER_STATE(): typeof BANNER_STATE {
        return BANNER_STATE
    }

    get STORAGE_TYPE(): typeof STORAGE_TYPE {
        return STORAGE_TYPE
    }

    get VISIBILITY_STATE(): typeof VISIBILITY_STATE {
        return VISIBILITY_STATE
    }

    get DEVICE_TYPE(): typeof DEVICE_TYPE {
        return DEVICE_TYPE
    }

    get DEVICE_ORIENTATION(): typeof DEVICE_ORIENTATION {
        return DEVICE_ORIENTATION
    }

    #isInitialized = false

    #initializationPromiseDecorator: PromiseDecorator<void> | null = null

    #platformBridge: PlatformBridgeBase | null = null

    #modules: Record<string, unknown> = {}

    #engine = 'javascript'

    async initialize(options?: PlaygamaInitOptions): Promise<void> {
        if (this.#isInitialized) {
            return Promise.resolve()
        }

        if (!this.#initializationPromiseDecorator) {
            this.#initializationPromiseDecorator = new PromiseDecorator<void>()

            const startTime = performance.now()
            const configFilePath = options?.configFilePath
            await configFileModule.load(configFilePath, options)

            await this.#createPlatformBridge()

            const bridge = this.#platformBridge as PlatformBridgeBase & { engine?: string }
            bridge.engine = this.engine

            this.#modules[MODULE_NAME.PLATFORM] = new PlatformModule(bridge as never)
            this.#modules[MODULE_NAME.PLAYER] = new PlayerModule(bridge as never)
            this.#modules[MODULE_NAME.GAME] = new GameModule(bridge as never)
            this.#modules[MODULE_NAME.STORAGE] = new StorageModule(bridge as never)
            this.#modules[MODULE_NAME.ADVERTISEMENT] = new AdvertisementModule(bridge as never)
            this.#modules[MODULE_NAME.SOCIAL] = new SocialModule(bridge as never)
            this.#modules[MODULE_NAME.DEVICE] = new DeviceModule(bridge as never)
            this.#modules[MODULE_NAME.LEADERBOARDS] = this.#isSaas(MODULE_NAME.LEADERBOARDS)
                ? new LeaderboardsSaasModule(bridge as never)
                : new LeaderboardsModule(bridge as never)
            this.#modules[MODULE_NAME.PAYMENTS] = new PaymentsModule(bridge as never)
            this.#modules[MODULE_NAME.REMOTE_CONFIG] = new RemoteConfigModule(bridge as never)
            this.#modules[MODULE_NAME.CLIPBOARD] = new ClipboardModule(bridge as never)
            this.#modules[MODULE_NAME.ACHIEVEMENTS] = new AchievementsModule(bridge as never)
            this.#modules[MODULE_NAME.ANALYTICS] = (analyticsModule as unknown as AnalyticsModuleLike).initialize(bridge)

            bridge
                .initialize()
                .then(() => {
                    this.#isInitialized = true

                    console.info(`%c PlaygamaBridge v${this.version} initialized. `, 'background: #01A5DA; color: white')

                    const endTime = performance.now()
                    const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2);
                    (analyticsModule as unknown as AnalyticsModuleLike).send(
                        `${MODULE_NAME.CORE}_initialization_completed`,
                        { time_s: timeInSeconds },
                    )

                    if (this.#initializationPromiseDecorator) {
                        this.#initializationPromiseDecorator.resolve()
                        this.#initializationPromiseDecorator = null
                    }

                    const adOptions = (bridge.options as { advertisement?: { interstitial?: { preloadOnStart?: string }; rewarded?: { preloadOnStart?: string } } })?.advertisement
                    const adModule = this.#modules[MODULE_NAME.ADVERTISEMENT] as AdvertisementModule

                    if (adOptions?.interstitial?.preloadOnStart) {
                        adModule.preloadInterstitial(adOptions.interstitial.preloadOnStart)
                    }

                    if (adOptions?.rewarded?.preloadOnStart) {
                        adModule.preloadRewarded(adOptions.rewarded.preloadOnStart)
                    }
                })
                .catch((error) => {
                    const endTime = performance.now()
                    const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2)
                    const errorMessage = error?.message || String(error);
                    (analyticsModule as unknown as AnalyticsModuleLike).send(
                        `${MODULE_NAME.CORE}_initialization_failed`,
                        { error: errorMessage, time_s: timeInSeconds },
                    )
                    console.error('PlaygamaBridge initialization failed:', error)
                })
                .finally(() => {
                    setTimeout(
                        () => (this.#modules[MODULE_NAME.GAME] as GameModule).setLoadingProgress(100, true),
                        700,
                    )
                })
        }

        return this.#initializationPromiseDecorator!.promise
    }

    async #createPlatformBridge(): Promise<void> {
        let platformId: PlatformId = PLATFORM_ID.MOCK

        const url = new URL(window.location.href)

        if (configFileModule.options.forciblySetPlatformId) {
            platformId = this.#getPlatformId(String(configFileModule.options.forciblySetPlatformId).toLowerCase())
        } else if (url.searchParams.has('platform_id')) {
            platformId = this.#getPlatformId((url.searchParams.get('platform_id') ?? '').toLowerCase())
        } else if (__INCLUDE_YANDEX__ && (url.hostname.includes(['y', 'a', 'n', 'd', 'e', 'x', '.', 'n', 'e', 't'].join('')) || url.hash.includes('yandex'))) {
            platformId = PLATFORM_ID.YANDEX
        } else if (__INCLUDE_CRAZY_GAMES__ && (url.hostname.includes('crazygames.') || url.hostname.includes('1001juegos.com'))) {
            platformId = PLATFORM_ID.CRAZY_GAMES
        } else if (__INCLUDE_GAME_DISTRIBUTION__ && url.hostname.includes('gamedistribution.com')) {
            platformId = PLATFORM_ID.GAME_DISTRIBUTION
        } else if (__INCLUDE_LAGGED__ && url.hostname.includes('lagged.')) {
            platformId = PLATFORM_ID.LAGGED
        } else if (__INCLUDE_VK__ && ((url.searchParams.has('api_id') && url.searchParams.has('viewer_id') && url.searchParams.has('auth_key')) || url.searchParams.has('vk_app_id'))) {
            platformId = PLATFORM_ID.VK
        } else if (__INCLUDE_ABSOLUTE_GAMES__ && (url.searchParams.has('app_id') && url.searchParams.has('player_id') && url.searchParams.has('game_sid') && url.searchParams.has('auth_key'))) {
            platformId = PLATFORM_ID.ABSOLUTE_GAMES
        } else if (__INCLUDE_PLAYDECK__ && url.searchParams.has('playdeck')) {
            platformId = PLATFORM_ID.PLAYDECK
        } else if (__INCLUDE_TELEGRAM__ && url.hash.includes('tgWebAppData')) {
            platformId = PLATFORM_ID.TELEGRAM
        } else if (__INCLUDE_Y8__ && url.hostname.includes('y8')) {
            platformId = PLATFORM_ID.Y8
        } else if (__INCLUDE_FACEBOOK__ && url.hostname.includes('fbsbx')) {
            platformId = PLATFORM_ID.FACEBOOK
        } else if (__INCLUDE_POKI__ && (url.hostname.includes('poki-gdn') || url.hostname.includes('poki-user-content'))) {
            platformId = PLATFORM_ID.POKI
        } else if (__INCLUDE_MSN__ && (url.hostname.includes('msn.') || url.hostname.includes('msnfun.') || url.hostname.includes('start.gg'))) {
            platformId = PLATFORM_ID.MSN
        } else if (__INCLUDE_BITQUEST__ && (url.hash.includes('customUrl_') || document.referrer.includes('bitquest'))) {
            platformId = PLATFORM_ID.BITQUEST
        } else if (__INCLUDE_GAMEPUSH__ && url.hostname.includes('eponesh.')) {
            platformId = PLATFORM_ID.GAMEPUSH
        } else if (__INCLUDE_DISCORD__ && url.hostname.includes('discordsays.com')) {
            platformId = PLATFORM_ID.DISCORD
        } else if (__INCLUDE_YOUTUBE__ && url.hostname.includes('usercontent.goog')) {
            platformId = PLATFORM_ID.YOUTUBE
        } else if (__INCLUDE_PORTAL__ && url.hostname.includes('portalapp.')) {
            platformId = PLATFORM_ID.PORTAL
        } else if (__INCLUDE_REDDIT__ && url.hostname.includes('devvit.')) {
            platformId = PLATFORM_ID.REDDIT
        } else if (__INCLUDE_DLIGHTEK__ && (url.hostname.includes('hippoobox.com') || url.hostname.includes('ahagamecenter.com'))) {
            platformId = PLATFORM_ID.DLIGHTEK
        } else if (__INCLUDE_TIKTOK__ && typeof window.TTMinis !== 'undefined') {
            platformId = PLATFORM_ID.TIKTOK
        } else if (__INCLUDE_GAMESNACKS__ && typeof window.GameSnacks !== 'undefined') {
            platformId = PLATFORM_ID.GAMESNACKS
        }

        const PlatformBridge = await fetchPlatformBridge(platformId)
        this.#platformBridge = new PlatformBridge() as PlatformBridgeBase
    }

    #getPlatformId(value: string): PlatformId {
        const platformIds = Object.values(PLATFORM_ID) as string[]
        for (let i = 0; i < platformIds.length; i++) {
            if (value === platformIds[i]) {
                return value as PlatformId
            }
        }

        return PLATFORM_ID.MOCK
    }

    #getModule(id: string): unknown {
        if (!this.#isInitialized) {
            console.error(ERROR.SDK_NOT_INITIALIZED)
        }

        return this.#modules[id]
    }

    #isSaas(feature: string): boolean {
        if (!this.#platformBridge) {
            return false
        }

        const { options, platformId } = this.#platformBridge as PlatformBridgeBase & {
            options: { saas?: Record<string, { platforms?: string[] }> }
        }

        return Boolean(
            options.saas?.[feature]
            && Array.isArray(options.saas[feature].platforms)
            && options.saas[feature].platforms!.includes(platformId),
        )
    }
}

applyEventBusMixin(PlaygamaBridge.prototype)
export default PlaygamaBridge
