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
    MODULE_NAME,
    EVENT_NAME,
    ERROR,
    ERROR_CODE,
    BridgeError,
} from './constants'
import {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    type PlatformId,
} from './modules/platform/constants'
import { DEVICE_TYPE, DEVICE_ORIENTATION } from './modules/device/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from './modules/advertisement/constants'

import { applyEventBusMixin } from './lib/EventBus'
import Deferred from './lib/Deferred'
import { LoadingScreen } from './lib/loading-screen'
import { SafeArea } from './lib/safe-area'
import configLoader from './lib/bridge-config-loader'
import logger, { createModuleLoggerProxy, LOGS_QUERY_PARAM } from './lib/logger'
import PlatformModule from './modules/platform'
import PlayerModule from './modules/player'
import StorageModule from './modules/storage'
import AdvertisementModule from './modules/advertisement'
import SocialModule from './modules/social'
import DeviceModule from './modules/device'
import LeaderboardsModule, { LeaderboardsSaasModule } from './modules/leaderboards'
import PaymentsModule from './modules/payments'
import RemoteConfigModule from './modules/remote-config'
import ClipboardModule from './modules/clipboard'
import AchievementsModule from './modules/achievements'
import analyticsModule, { internalAnalytics } from './modules/analytics'
import { fetchPlatformBridge } from './platformImports'
import { PLATFORM_DETECTORS, type PlatformDetectorContext } from './platformDetectors'
import type PlatformBridgeBase from './platform-bridges/PlatformBridgeBase'
import type { EventEmitter } from './lib/EventBus'

export interface PlaygamaInitOptions {
    configFilePath?: string
    [key: string]: unknown
}

// Data-driven module wiring. Each entry maps a MODULE_NAME to a factory
// that produces the module instance from the already-constructed platform bridge.
type ModuleFactory = (bridge: PlatformBridgeBase) => unknown
interface ModuleEntry {
    name: string
    factory: ModuleFactory
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

    // Constants are exposed on the prototype below the class declaration
    /* eslint-disable lines-between-class-members */
    declare readonly PLATFORM_ID: typeof PLATFORM_ID
    declare readonly PLATFORM_MESSAGE: typeof PLATFORM_MESSAGE
    declare readonly MODULE_NAME: typeof MODULE_NAME
    declare readonly EVENT_NAME: typeof EVENT_NAME
    declare readonly INTERSTITIAL_STATE: typeof INTERSTITIAL_STATE
    declare readonly REWARDED_STATE: typeof REWARDED_STATE
    declare readonly BANNER_STATE: typeof BANNER_STATE
    declare readonly DEVICE_TYPE: typeof DEVICE_TYPE
    declare readonly DEVICE_ORIENTATION: typeof DEVICE_ORIENTATION
    /* eslint-enable lines-between-class-members */

    #isInitialized = false

    #initializationPromiseDecorator: Deferred<void> | null = null

    #platformBridge: PlatformBridgeBase | null = null

    #modules: Record<string, unknown> = {}

    #loadingScreen: LoadingScreen | null = null

    #engine = 'javascript'

    async initialize(options?: PlaygamaInitOptions): Promise<void> {
        if (this.#isInitialized) {
            return Promise.resolve()
        }

        if (!this.#initializationPromiseDecorator) {
            this.#initializationPromiseDecorator = new Deferred<void>()

            // The URL parameter, when present, overrides the config file value.
            const url = new URL(window.location.href)
            const logsParamPresent = url.searchParams.has(LOGS_QUERY_PARAM)
            if (logsParamPresent) {
                logger.enabled = url.searchParams.get(LOGS_QUERY_PARAM) !== 'false'
            }

            logger.info('Initialization started')

            const startTime = performance.now()
            const configFilePath = options?.configFilePath
            await configLoader.load(configFilePath, options)

            if (!logsParamPresent) {
                logger.enabled = configLoader.options.logs === true
            }

            logger.info('Config loaded')

            await this.#createPlatformBridge()

            const bridge = this.#platformBridge as PlatformBridgeBase & { engine?: string }
            bridge.engine = this.engine

            this.#setupLoadingVisuals(bridge)

            const moduleRegistry: ModuleEntry[] = [
                { name: MODULE_NAME.PLATFORM, factory: (b) => new PlatformModule(b as never) },
                { name: MODULE_NAME.PLAYER, factory: (b) => new PlayerModule(b as never) },
                { name: MODULE_NAME.STORAGE, factory: (b) => new StorageModule(b as never) },
                { name: MODULE_NAME.ADVERTISEMENT, factory: (b) => new AdvertisementModule(b as never) },
                { name: MODULE_NAME.SOCIAL, factory: (b) => new SocialModule(b as never) },
                { name: MODULE_NAME.DEVICE, factory: (b) => new DeviceModule(b as never) },
                {
                    name: MODULE_NAME.LEADERBOARDS,
                    factory: (b) => (this.#isSaas(MODULE_NAME.LEADERBOARDS)
                        ? new LeaderboardsSaasModule(b as never)
                        : new LeaderboardsModule(b as never)),
                },
                { name: MODULE_NAME.PAYMENTS, factory: (b) => new PaymentsModule(b as never) },
                { name: MODULE_NAME.REMOTE_CONFIG, factory: (b) => new RemoteConfigModule(b as never) },
                { name: MODULE_NAME.CLIPBOARD, factory: (b) => new ClipboardModule(b as never) },
                { name: MODULE_NAME.ACHIEVEMENTS, factory: (b) => new AchievementsModule(b as never) },
                { name: MODULE_NAME.ANALYTICS, factory: (b) => analyticsModule.initialize(b as never) },
            ]

            moduleRegistry.forEach((entry) => {
                const moduleInstance = entry.factory(bridge)
                this.#modules[entry.name] = typeof moduleInstance === 'object' && moduleInstance !== null
                    ? createModuleLoggerProxy(entry.name, moduleInstance)
                    : moduleInstance
            })

            bridge
                .initialize()
                .then(() => {
                    this.#isInitialized = true

                    logger.banner(`PlaygamaBridge v${this.version} initialized.`)

                    const endTime = performance.now()
                    const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2)
                    internalAnalytics.send(
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
                    const errorMessage = error?.message || String(error)
                    internalAnalytics.send(
                        `${MODULE_NAME.CORE}_initialization_failed`,
                        { error: errorMessage, time_s: timeInSeconds },
                    )

                    const initializationError = new BridgeError(ERROR_CODE.INITIALIZATION_FAILED, error)
                    logger.error(initializationError.message, error)

                    if (this.#initializationPromiseDecorator) {
                        this.#initializationPromiseDecorator.reject(initializationError)
                        this.#initializationPromiseDecorator = null
                    }
                })
                .finally(() => {
                    setTimeout(() => this.#loadingScreen?.setProgress(100, true), 700)
                })
        }

        return this.#initializationPromiseDecorator!.promise
    }

    async #createPlatformBridge(): Promise<void> {
        let platformId: PlatformId = PLATFORM_ID.MOCK

        const url = new URL(window.location.href)

        if (configLoader.options.forciblySetPlatformId) {
            platformId = this.#getPlatformId(String(configLoader.options.forciblySetPlatformId).toLowerCase())
        } else if (url.searchParams.has('platform_id')) {
            platformId = this.#getPlatformId((url.searchParams.get('platform_id') ?? '').toLowerCase())
        } else {
            const ctx: PlatformDetectorContext = {
                url,
                hostname: url.hostname,
                hash: url.hash,
                searchParams: url.searchParams,
                referrer: document.referrer,
                win: window,
            }
            const detected = PLATFORM_DETECTORS.find(({ predicate }) => predicate(ctx))
            if (detected) {
                platformId = detected.platformId
            }
        }

        logger.info(`Platform detected: ${platformId}`)

        const PlatformBridge = await fetchPlatformBridge(platformId)
        this.#platformBridge = new PlatformBridge() as PlatformBridgeBase
    }

    #setupLoadingVisuals(bridge: PlatformBridgeBase): void {
        const options = (bridge.options ?? {}) as {
            disableLoadingLogo?: boolean
            showFullLoadingLogo?: boolean
            showLoadingText?: boolean
            game?: { adaptToSafeArea?: boolean }
        }

        if (!options.disableLoadingLogo) {
            const showFullLogo = bridge.platformId === PLATFORM_ID.YANDEX
                || bridge.platformId === PLATFORM_ID.Y8
                ? false
                : options.showFullLoadingLogo === true
            const showLoadingText = bridge.platformId === PLATFORM_ID.XIAOMI
                || options.showLoadingText === true
            this.#loadingScreen = new LoadingScreen()
            this.#loadingScreen.show({ showFullLogo, showLoadingText })
        }

        if (options.game?.adaptToSafeArea) {
            SafeArea.applyStyles()
        }
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
            logger.error(ERROR.SDK_NOT_INITIALIZED.message)
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

Object.assign(PlaygamaBridge.prototype, {
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    MODULE_NAME,
    EVENT_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    DEVICE_TYPE,
    DEVICE_ORIENTATION,
})

export default PlaygamaBridge
