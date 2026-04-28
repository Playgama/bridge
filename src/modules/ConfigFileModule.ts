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

import { deepMerge } from '../common/utils'
import ModuleBase from './ModuleBase'
import type { AnyRecord } from '../types/common'

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

export interface ConfigFileOptions extends AnyRecord {
    platforms?: Record<string, AnyRecord>
}

class ConfigFileModule extends ModuleBase {
    // public getters
    get options(): ConfigFileOptions {
        return this.#options
    }

    get loadStatus(): LoadStatus {
        return this.#loadStatus
    }

    get parseStatus(): ParseStatus {
        return this.#parseStatus
    }

    get path(): string {
        return this.#path
    }

    get rawContent(): string {
        return this.#rawContent
    }

    get parsedContent(): AnyRecord {
        return this.#parsedContent
    }

    get loadError(): string {
        return this.#loadError
    }

    get parseError(): string {
        return this.#parseError
    }

    // private properties
    #defaultConfigFilePath = './playgama-bridge-config.json'

    #loadStatus: LoadStatus = LOAD_STATUS.PENDING

    #parseStatus: ParseStatus = PARSE_STATUS.PENDING

    #path = ''

    #rawContent = ''

    #parsedContent: AnyRecord = {}

    #loadError = ''

    #parseError = ''

    #options: ConfigFileOptions = {}

    #fallbackOptions: ConfigFileOptions = {}

    // public methods
    async load(configFilePath?: string, fallbackOptions: ConfigFileOptions = {}): Promise<void> {
        this.#path = configFilePath || this.#defaultConfigFilePath
        this.#fallbackOptions = fallbackOptions

        try {
            this.#loadStatus = LOAD_STATUS.LOADING
            const response = await fetch(this.#path)

            if (!response.ok) {
                throw new Error(`Failed to load bridge config: ${this.#path} ${response.status} (${response.statusText})`)
            }

            const text = await response.text()
            this.#rawContent = text
            this.#loadStatus = LOAD_STATUS.SUCCESS
            this.#parseContent(text)
        } catch (error) {
            this.#setOptions(this.#fallbackOptions)
            this.#loadStatus = LOAD_STATUS.FAILED
            this.#loadError = (error as Error).message || String(error)
            console.error(error)
        }
    }

    getPlatformOptions(platformId: string): ConfigFileOptions {
        const currentPlatformOptions = this.options.platforms?.[platformId]
        if (currentPlatformOptions) {
            return deepMerge(this.options, currentPlatformOptions) as ConfigFileOptions
        }
        return this.options
    }

    // private methods
    #parseContent(text: string): void {
        try {
            const data = JSON.parse(text) as AnyRecord
            this.#parsedContent = data
            this.#parseStatus = PARSE_STATUS.SUCCESS
            this.#setOptions(data as ConfigFileOptions)
        } catch (parseError) {
            this.#setOptions(this.#fallbackOptions)
            this.#parseStatus = PARSE_STATUS.FAILED
            this.#parseError = `Failed to parse bridge config: ${(parseError as Error).message || String(parseError)}`
            console.error('Config parsing error.', parseError)
        }
    }

    #setOptions(options: ConfigFileOptions): void {
        this.#options = { ...options }
    }
}

export { ConfigFileModule }
export default new ConfigFileModule(undefined as never)
