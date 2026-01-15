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

export const LOAD_STATUS = {
    PENDING: 'pending',
    LOADING: 'loading',
    SUCCESS: 'success',
    FAILED: 'failed',
}

export const PARSE_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
}

class ConfigFileModule extends ModuleBase {
    // public getters
    get options() {
        return this.#options
    }

    get loadStatus() {
        return this.#loadStatus
    }

    get parseStatus() {
        return this.#parseStatus
    }

    get path() {
        return this.#path
    }

    get rawContent() {
        return this.#rawContent
    }

    get parsedContent() {
        return this.#parsedContent
    }

    get loadError() {
        return this.#loadError
    }

    get parseError() {
        return this.#parseError
    }

    // private properties
    #defaultConfigFilePath = './playgama-bridge-config.json'

    #loadStatus = LOAD_STATUS.PENDING

    #parseStatus = PARSE_STATUS.PENDING

    #path = ''

    #rawContent = ''

    #parsedContent = {}

    #loadError = ''

    #parseError = ''

    #options = {}

    #fallbackOptions = {}

    // public methods
    async load(configFilePath, fallbackOptions = {}) {
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
            this.#loadError = error.message || String(error)
            console.error(error)
        }
    }

    getPlatformOptions(platformId) {
        const currentPlatformOptions = this.options.platforms?.[platformId]
        if (currentPlatformOptions) {
            return deepMerge(this.options, currentPlatformOptions)
        }
        return this.options
    }

    // private methods
    #parseContent(text) {
        try {
            const data = JSON.parse(text)
            this.#parsedContent = data
            this.#parseStatus = PARSE_STATUS.SUCCESS
            this.#setOptions(data)
        } catch (parseError) {
            this.#setOptions(this.#fallbackOptions)
            this.#parseStatus = PARSE_STATUS.FAILED
            this.#parseError = `Failed to parse bridge config: ${parseError.message || String(parseError)}`
            console.error('Config parsing error.', parseError)
        }
    }

    #setOptions(options) {
        this.#options = { ...options }
    }
}

export { ConfigFileModule }
export default new ConfigFileModule()
