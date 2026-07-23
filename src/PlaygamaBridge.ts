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
    LAUNCH_SOURCE,
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
import bridgeConfig from './lib/bridge-config'
import { initApiOrigin } from './lib/apiOrigin'
import logger, { createModuleLoggerProxy, DEBUG_QUERY_PARAM } from './lib/logger'
import platformModule from './modules/platform'
import playerModule from './modules/player'
import storageModule from './modules/storage'
import advertisementModule from './modules/advertisement'
import socialModule from './modules/social'
import deviceModule from './modules/device'
import leaderboardsModule from './modules/leaderboards'
import paymentsModule from './modules/payments'
import remoteConfigModule from './modules/remote-config'
import clipboardModule from './modules/clipboard'
import achievementsModule from './modules/achievements'
import dailyRewardsModule from './modules/daily-rewards'
import tasksModule from './modules/tasks'
import crossPromoModule from './modules/cross-promo'
import analyticsModule, { internalAnalytics } from './modules/analytics'
import { applyBrowserDefaultsProtection } from './utils'
import { fetchPlatformBridge } from './platformImports'
import { detectPlatformId } from './platformDetectors'
import type PlatformBridgeBase from './platform-bridges/PlatformBridgeBase'
import type { EventEmitter } from './lib/EventBus'

export interface PlaygamaInitOptions {
    configFilePath?: string
    [key: string]: unknown
}

// Data-driven module wiring. Each entry pairs a MODULE_NAME with its singleton
// module instance; the platform bridge is injected via initialize() during init.
interface ModuleEntry {
    name: string
    module: { initialize(platformBridge: never): unknown }
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

    get platform(): typeof platformModule {
        return this.#getModule(MODULE_NAME.PLATFORM) as typeof platformModule
    }

    get player(): typeof playerModule {
        return this.#getModule(MODULE_NAME.PLAYER) as typeof playerModule
    }

    get storage(): typeof storageModule {
        return this.#getModule(MODULE_NAME.STORAGE) as typeof storageModule
    }

    get advertisement(): typeof advertisementModule {
        return this.#getModule(MODULE_NAME.ADVERTISEMENT) as typeof advertisementModule
    }

    get social(): typeof socialModule {
        return this.#getModule(MODULE_NAME.SOCIAL) as typeof socialModule
    }

    get device(): typeof deviceModule {
        return this.#getModule(MODULE_NAME.DEVICE) as typeof deviceModule
    }

    get leaderboards(): typeof leaderboardsModule {
        return this.#getModule(MODULE_NAME.LEADERBOARDS) as typeof leaderboardsModule
    }

    get payments(): typeof paymentsModule {
        return this.#getModule(MODULE_NAME.PAYMENTS) as typeof paymentsModule
    }

    get achievements(): typeof achievementsModule {
        return this.#getModule(MODULE_NAME.ACHIEVEMENTS) as typeof achievementsModule
    }

    get remoteConfig(): typeof remoteConfigModule {
        return this.#getModule(MODULE_NAME.REMOTE_CONFIG) as typeof remoteConfigModule
    }

    get clipboard(): typeof clipboardModule {
        return this.#getModule(MODULE_NAME.CLIPBOARD) as typeof clipboardModule
    }

    get analytics(): typeof analyticsModule {
        return this.#getModule(MODULE_NAME.ANALYTICS) as typeof analyticsModule
    }

    get dailyRewards(): typeof dailyRewardsModule {
        return this.#getModule(MODULE_NAME.DAILY_REWARDS) as typeof dailyRewardsModule
    }

    get tasks(): typeof tasksModule {
        return this.#getModule(MODULE_NAME.TASKS) as typeof tasksModule
    }

    get crossPromo(): typeof crossPromoModule {
        return this.#getModule(MODULE_NAME.CROSS_PROMO) as typeof crossPromoModule
    }

    get engine(): string {
        return this.#engine
    }

    set engine(value: string) {
        this.#engine = value
    }

    set gameVersion(value: string | null) {
        analyticsModule.gameVersion = value
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
    declare readonly LAUNCH_SOURCE: typeof LAUNCH_SOURCE
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
            const debugParamPresent = url.searchParams.has(DEBUG_QUERY_PARAM)
            if (debugParamPresent) {
                logger.enabled = url.searchParams.get(DEBUG_QUERY_PARAM) !== 'false'
            }

            logger.info('Initialization started')

            const startTime = performance.now()
            const configFilePath = options?.configFilePath
            await bridgeConfig.load(configFilePath, options)

            const platformId = detectPlatformId(bridgeConfig.getRawValues().forciblySetPlatformId)
            bridgeConfig.initialize(platformId)
            initApiOrigin(platformId)

            if (!debugParamPresent) {
                logger.enabled = bridgeConfig.getValues().debug === true
            }

            logger.info('Config loaded')

            applyBrowserDefaultsProtection()

            await this.#createPlatformBridge(platformId)

            const bridge = this.#platformBridge as PlatformBridgeBase & { engine?: string }
            bridge.engine = this.engine

            this.#setupLoadingVisuals(bridge)

            const moduleRegistry: ModuleEntry[] = [
                { name: MODULE_NAME.PLATFORM, module: platformModule },
                { name: MODULE_NAME.PLAYER, module: playerModule },
                { name: MODULE_NAME.STORAGE, module: storageModule },
                { name: MODULE_NAME.ADVERTISEMENT, module: advertisementModule },
                { name: MODULE_NAME.SOCIAL, module: socialModule },
                { name: MODULE_NAME.DEVICE, module: deviceModule },
                { name: MODULE_NAME.LEADERBOARDS, module: leaderboardsModule },
                { name: MODULE_NAME.PAYMENTS, module: paymentsModule },
                { name: MODULE_NAME.REMOTE_CONFIG, module: remoteConfigModule },
                { name: MODULE_NAME.CLIPBOARD, module: clipboardModule },
                { name: MODULE_NAME.ACHIEVEMENTS, module: achievementsModule },
                { name: MODULE_NAME.ANALYTICS, module: analyticsModule },
                { name: MODULE_NAME.DAILY_REWARDS, module: dailyRewardsModule },
                { name: MODULE_NAME.TASKS, module: tasksModule },
                { name: MODULE_NAME.CROSS_PROMO, module: crossPromoModule },
            ]

            moduleRegistry.forEach(({ name, module }) => {
                module.initialize(bridge as never)
                this.#modules[name] = createModuleLoggerProxy(name, module as object)
            })

            bridge
                .initialize()
                .then(() => {
                    this.#isInitialized = true

                    logger.banner(`PlaygamaBridge v${this.version} initialized.`)

                    if (this.#initializationPromiseDecorator) {
                        this.#initializationPromiseDecorator.resolve()
                        this.#initializationPromiseDecorator = null
                    }

                    const adOptions = bridgeConfig.getValues().advertisement
                    const adModule = this.#modules[MODULE_NAME.ADVERTISEMENT] as typeof advertisementModule

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

    setGameLoadingProgress(percent: number): void {
        this.#loadingScreen?.setProgress(percent)
    }

    async #createPlatformBridge(platformId: PlatformId): Promise<void> {
        logger.info(`Platform detected: ${platformId}`)

        const PlatformBridge = await fetchPlatformBridge(platformId)
        this.#platformBridge = new PlatformBridge() as PlatformBridgeBase
    }

    #setupLoadingVisuals(bridge: PlatformBridgeBase): void {
        const options = bridgeConfig.getValues()

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

    #getModule(id: string): unknown {
        if (!this.#isInitialized) {
            logger.error(ERROR.SDK_NOT_INITIALIZED.message)
        }

        return this.#modules[id]
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
    LAUNCH_SOURCE,
})

export default PlaygamaBridge
