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
} from './constants'

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

class PlaygamaBridge {
    get version() {
        return PLUGIN_VERSION
    }

    get isInitialized() {
        return this.#isInitialized
    }

    get options() {
        return this.#platformBridge.options
    }

    get platform() {
        return this.#getModule(MODULE_NAME.PLATFORM)
    }

    get player() {
        return this.#getModule(MODULE_NAME.PLAYER)
    }

    get game() {
        return this.#getModule(MODULE_NAME.GAME)
    }

    get storage() {
        return this.#getModule(MODULE_NAME.STORAGE)
    }

    get advertisement() {
        return this.#getModule(MODULE_NAME.ADVERTISEMENT)
    }

    get social() {
        return this.#getModule(MODULE_NAME.SOCIAL)
    }

    get device() {
        return this.#getModule(MODULE_NAME.DEVICE)
    }

    get leaderboard() {
        return this.#getModule(MODULE_NAME.LEADERBOARDS)
    }

    get leaderboards() {
        return this.#getModule(MODULE_NAME.LEADERBOARDS)
    }

    get payments() {
        return this.#getModule(MODULE_NAME.PAYMENTS)
    }

    get achievements() {
        return this.#getModule(MODULE_NAME.ACHIEVEMENTS)
    }

    get remoteConfig() {
        return this.#getModule(MODULE_NAME.REMOTE_CONFIG)
    }

    get clipboard() {
        return this.#getModule(MODULE_NAME.CLIPBOARD)
    }

    get analytics() {
        return this.#getModule(MODULE_NAME.ANALYTICS)
    }

    get engine() {
        return this.#engine
    }

    set engine(value) {
        this.#engine = value
    }

    get PLATFORM_ID() {
        return PLATFORM_ID
    }

    get PLATFORM_MESSAGE() {
        return PLATFORM_MESSAGE
    }

    get MODULE_NAME() {
        return MODULE_NAME
    }

    get EVENT_NAME() {
        return EVENT_NAME
    }

    get INTERSTITIAL_STATE() {
        return INTERSTITIAL_STATE
    }

    get REWARDED_STATE() {
        return REWARDED_STATE
    }

    get BANNER_STATE() {
        return BANNER_STATE
    }

    get STORAGE_TYPE() {
        return STORAGE_TYPE
    }

    get VISIBILITY_STATE() {
        return VISIBILITY_STATE
    }

    get DEVICE_TYPE() {
        return DEVICE_TYPE
    }

    get DEVICE_ORIENTATION() {
        return DEVICE_ORIENTATION
    }

    #isInitialized = false

    #initializationPromiseDecorator = null

    #platformBridge = null

    #modules = {}

    #engine = 'javascript'

    async initialize(options) {
        if (this.#isInitialized) {
            return Promise.resolve()
        }

        if (!this.#initializationPromiseDecorator) {
            this.#initializationPromiseDecorator = new PromiseDecorator()

            const startTime = performance.now()
            const configFilePath = options?.configFilePath
            await configFileModule.load(configFilePath, options)

            await this.#createPlatformBridge()

            this.#platformBridge.engine = this.engine

            this.#modules[MODULE_NAME.PLATFORM] = new PlatformModule(this.#platformBridge)
            this.#modules[MODULE_NAME.PLAYER] = new PlayerModule(this.#platformBridge)
            this.#modules[MODULE_NAME.GAME] = new GameModule(this.#platformBridge)
            this.#modules[MODULE_NAME.STORAGE] = new StorageModule(this.#platformBridge)
            this.#modules[MODULE_NAME.ADVERTISEMENT] = new AdvertisementModule(this.#platformBridge)
            this.#modules[MODULE_NAME.SOCIAL] = new SocialModule(this.#platformBridge)
            this.#modules[MODULE_NAME.DEVICE] = new DeviceModule(this.#platformBridge)
            this.#modules[MODULE_NAME.LEADERBOARDS] = this.#isSaas(MODULE_NAME.LEADERBOARDS)
                ? new LeaderboardsSaasModule(this.#platformBridge)
                : new LeaderboardsModule(this.#platformBridge)
            this.#modules[MODULE_NAME.PAYMENTS] = new PaymentsModule(this.#platformBridge)
            this.#modules[MODULE_NAME.REMOTE_CONFIG] = new RemoteConfigModule(this.#platformBridge)
            this.#modules[MODULE_NAME.CLIPBOARD] = new ClipboardModule(this.#platformBridge)
            this.#modules[MODULE_NAME.ACHIEVEMENTS] = new AchievementsModule(this.#platformBridge)
            this.#modules[MODULE_NAME.ANALYTICS] = analyticsModule.initialize(this.#platformBridge)

            this.#platformBridge
                .initialize()
                .then(() => {
                    this.#isInitialized = true

                    console.info(`%c PlaygamaBridge v${this.version} initialized. `, 'background: #01A5DA; color: white')

                    const endTime = performance.now()
                    const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2)
                    analyticsModule.send(`${MODULE_NAME.CORE}_initialization_completed`, { time_s: timeInSeconds })

                    if (this.#initializationPromiseDecorator) {
                        this.#initializationPromiseDecorator.resolve()
                        this.#initializationPromiseDecorator = null
                    }

                    if (this.#platformBridge.options?.advertisement?.interstitial?.preloadOnStart) {
                        const placement = this.#platformBridge.options.advertisement.interstitial.preloadOnStart
                        this.#modules[MODULE_NAME.ADVERTISEMENT].preloadInterstitial(placement)
                    }

                    if (this.#platformBridge.options?.advertisement?.rewarded?.preloadOnStart) {
                        const placement = this.#platformBridge.options.advertisement.rewarded.preloadOnStart
                        this.#modules[MODULE_NAME.ADVERTISEMENT].preloadRewarded(placement)
                    }
                })
                .catch((error) => {
                    const endTime = performance.now()
                    const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2)
                    const errorMessage = error?.message || String(error)
                    analyticsModule.send(`${MODULE_NAME.CORE}_initialization_failed`, { error: errorMessage, time_s: timeInSeconds })
                    console.error('PlaygamaBridge initialization failed:', error)
                })
                .finally(() => {
                    setTimeout(
                        () => this.#modules[MODULE_NAME.GAME].setLoadingProgress(100, true),
                        700,
                    )
                })
        }

        return this.#initializationPromiseDecorator.promise
    }

    async #createPlatformBridge() {
        let platformId = PLATFORM_ID.MOCK

        const url = new URL(window.location.href)

        if (configFileModule.options.forciblySetPlatformId) {
            platformId = this.#getPlatformId(configFileModule.options.forciblySetPlatformId.toLowerCase())
        } else {
            const yandexUrl = ['y', 'a', 'n', 'd', 'e', 'x', '.', 'n', 'e', 't'].join('')
            if (url.searchParams.has('platform_id')) {
                platformId = this.#getPlatformId(url.searchParams.get('platform_id').toLowerCase())
            } else if (url.hostname.includes(yandexUrl) || url.hash.includes('yandex')) {
                platformId = PLATFORM_ID.YANDEX
            } else if (url.hostname.includes('crazygames.') || url.hostname.includes('1001juegos.com')) {
                platformId = PLATFORM_ID.CRAZY_GAMES
            } else if (url.hostname.includes('gamedistribution.com')) {
                platformId = PLATFORM_ID.GAME_DISTRIBUTION
            } else if (url.hostname.includes('lagged.')) {
                platformId = PLATFORM_ID.LAGGED
            } else if ((url.searchParams.has('api_id') && url.searchParams.has('viewer_id') && url.searchParams.has('auth_key')) || url.searchParams.has('vk_app_id')) {
                platformId = PLATFORM_ID.VK
            } else if (url.searchParams.has('app_id') && url.searchParams.has('player_id') && url.searchParams.has('game_sid') && url.searchParams.has('auth_key')) {
                platformId = PLATFORM_ID.ABSOLUTE_GAMES
            } else if (url.searchParams.has('playdeck')) {
                platformId = PLATFORM_ID.PLAYDECK
            } else if (url.hash.includes('tgWebAppData')) {
                platformId = PLATFORM_ID.TELEGRAM
            } else if (url.hostname.includes('y8')) {
                platformId = PLATFORM_ID.Y8
            } else if (url.hostname.includes('fbsbx')) {
                platformId = PLATFORM_ID.FACEBOOK
            } else if (url.hostname.includes('poki-gdn') || url.hostname.includes('poki-user-content')) {
                platformId = PLATFORM_ID.POKI
            } else if (url.hostname.includes('msn.') || url.hostname.includes('msnfun.') || url.hostname.includes('start.gg')) {
                platformId = PLATFORM_ID.MSN
            } else if (url.hash.includes('customUrl_') || document.referrer.includes('bitquest')) {
                platformId = PLATFORM_ID.BITQUEST
            } else if (url.hostname.includes('eponesh.')) {
                platformId = PLATFORM_ID.GAMEPUSH
            } else if (url.hostname.includes('discordsays.com')) {
                platformId = PLATFORM_ID.DISCORD
            } else if (url.hostname.includes('usercontent.goog')) {
                platformId = PLATFORM_ID.YOUTUBE
            } else if (url.hostname.includes('portalapp.')) {
                platformId = PLATFORM_ID.PORTAL
            } else if (url.hostname.includes('devvit.')) {
                platformId = PLATFORM_ID.REDDIT
            } else if (typeof window.TTMinis !== 'undefined') {
                platformId = PLATFORM_ID.TIKTOK
            }
        }

        const PlatformBridge = await fetchPlatformBridge(platformId)
        this.#platformBridge = new PlatformBridge()
    }

    #getPlatformId(value) {
        const platformIds = Object.values(PLATFORM_ID)
        for (let i = 0; i < platformIds.length; i++) {
            if (value === platformIds[i]) {
                return value
            }
        }

        return PLATFORM_ID.MOCK
    }

    #getModule(id) {
        if (!this.#isInitialized) {
            console.error(ERROR.SDK_NOT_INITIALIZED)
        }

        return this.#modules[id]
    }

    #isSaas(feature) {
        const { options, platformId } = this.#platformBridge

        return (
            options.saas?.[feature]
            && Array.isArray(options.saas[feature].platforms)
            && options.saas[feature].platforms.includes(platformId)
        )
    }
}

export default PlaygamaBridge
