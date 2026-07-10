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

import { deepMerge, type AnyRecord } from '../../utils'
import { ERROR_CODE, BridgeError } from '../../constants'
import logger from '../logger'
import type { ConfigFileOptions } from './types'
import { LOCAL_ONLY_CONFIG_FIELDS } from './constants'
import RemoteConfigLoader, {
    REMOTE_LOAD_STATUS,
    type RemoteAppliedSource,
    type RemoteLoadStatus,
} from './RemoteConfigLoader'

export const LOAD_STATUS = {
    PENDING: 'pending',
    LOADING: 'loading',
    SUCCESS: 'success',
    FAILED: 'failed',
} as const

export type LoadStatus = typeof LOAD_STATUS[keyof typeof LOAD_STATUS]

export const PARSE_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
} as const

export type ParseStatus = typeof PARSE_STATUS[keyof typeof PARSE_STATUS]

class BridgeConfig {
    // public getters
    get loadStatus(): LoadStatus {
        return this.#loadStatus
    }

    get parseStatus(): ParseStatus {
        return this.#parseStatus
    }

    get path(): string {
        return this.#path
    }

    get loadError(): string {
        return this.#loadError
    }

    get parseError(): string {
        return this.#parseError
    }

    get remoteLoadStatus(): RemoteLoadStatus {
        return this.#remoteLoader ? this.#remoteLoader.loadStatus : REMOTE_LOAD_STATUS.SKIPPED
    }

    get remoteLoadError(): string {
        return this.#remoteLoader ? this.#remoteLoader.loadError : ''
    }

    get remoteAppliedSource(): RemoteAppliedSource | null {
        return this.#remoteLoader ? this.#remoteLoader.appliedSource : null
    }

    // private properties
    #defaultConfigFilePath = './playgama-bridge-config.json'

    #loadStatus: LoadStatus = LOAD_STATUS.PENDING

    #parseStatus: ParseStatus = PARSE_STATUS.PENDING

    #path = ''

    #loadError = ''

    #parseError = ''

    // Raw config as loaded; what getRawValues() returns.
    #rawValues: ConfigFileOptions = {}

    // Config resolved for the active platform; what getValues() returns.
    // Mirrors #rawValues until initialize() merges in the platform overrides.
    #values: ConfigFileOptions = {}

    #fallbackValues: ConfigFileOptions = {}

    #remoteLoader: RemoteConfigLoader | null = null

    // public methods
    async load(configFilePath?: string, fallbackValues: ConfigFileOptions = {}): Promise<void> {
        this.#path = configFilePath || this.#defaultConfigFilePath
        this.#fallbackValues = fallbackValues

        try {
            this.#loadStatus = LOAD_STATUS.LOADING
            const response = await fetch(this.#path)

            if (!response.ok) {
                throw new Error(`Failed to load bridge config: ${this.#path} ${response.status} (${response.statusText})`)
            }

            const text = await response.text()
            this.#loadStatus = LOAD_STATUS.SUCCESS
            this.#parse(text)
            await this.#applyRemoteConfig()
        } catch (error) {
            this.#setValues(this.#fallbackValues)
            this.#loadStatus = LOAD_STATUS.FAILED
            this.#loadError = (error as Error).message || String(error)
            logger.error(new BridgeError(ERROR_CODE.CONFIG_LOAD_FAILED, error).message, error)
        }
    }

    // Resolves the loaded config for the given platform, merging its platform-specific
    // overrides into the base values. The platform id is detected by the caller, so the
    // config stays decoupled from platform-detection logic. Must run after load();
    // afterwards getValues() returns the platform-resolved values.
    initialize(platformId: string): void {
        const platformOverrides = this.#rawValues.platforms?.[platformId]
        this.#values = platformOverrides
            ? deepMerge(this.#rawValues, platformOverrides) as ConfigFileOptions
            : this.#rawValues
    }

    // Config resolved for the active platform. Mirrors the raw values until initialize() runs.
    getValues(): ConfigFileOptions {
        return this.#values
    }

    // Raw config as loaded, without any platform-specific resolution.
    getRawValues(): ConfigFileOptions {
        return this.#rawValues
    }

    // private methods
    #parse(text: string): void {
        try {
            const data = JSON.parse(text) as ConfigFileOptions
            this.#parseStatus = PARSE_STATUS.SUCCESS
            this.#setValues(data)
        } catch (parseError) {
            this.#setValues(this.#fallbackValues)
            this.#parseStatus = PARSE_STATUS.FAILED
            this.#parseError = `Failed to parse bridge config: ${(parseError as Error).message || String(parseError)}`
            logger.error(new BridgeError(ERROR_CODE.CONFIG_PARSE_FAILED, parseError).message, parseError)
        }
    }

    #setValues(values: ConfigFileOptions): void {
        this.#rawValues = { ...values }
        // Keep resolved values usable before initialize() applies platform overrides.
        this.#values = this.#rawValues
    }

    async #applyRemoteConfig(): Promise<void> {
        const url = this.#rawValues.remoteConfigUrl
        if (!url) {
            return
        }

        const loader = new RemoteConfigLoader({
            url,
            timeoutMs: this.#rawValues.remoteConfigTimeout,
            ttlMs: this.#rawValues.remoteConfigTtl,
        })

        this.#remoteLoader = loader

        const result = await loader.load()
        if (!result.options) {
            return
        }

        const localOnly: AnyRecord = {}
        LOCAL_ONLY_CONFIG_FIELDS.forEach((key) => {
            if (key in this.#rawValues) {
                localOnly[key] = this.#rawValues[key]
            }
        })

        this.#setValues({ ...result.options, ...localOnly } as ConfigFileOptions)
    }
}

export { BridgeConfig }
export default new BridgeConfig()
