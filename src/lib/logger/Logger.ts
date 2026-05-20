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
    LOG_LEVEL,
    type LogLevel,
    LOGGER_BADGE_LABEL,
    LOGGER_BADGE_STYLE,
    LOGGER_RESET_STYLE,
    LOGGER_BANNER_STYLE,
} from './constants'

class Logger {
    get enabled(): boolean {
        return this.#enabled
    }

    set enabled(value: boolean) {
        this.#enabled = value
    }

    #enabled = false

    info(message: string, ...args: unknown[]): void {
        this.#print(LOG_LEVEL.INFO, message, args)
    }

    warn(message: string, ...args: unknown[]): void {
        this.#print(LOG_LEVEL.WARN, message, args)
    }

    error(message: string, ...args: unknown[]): void {
        this.#print(LOG_LEVEL.ERROR, message, args)
    }

    // Branded notice that is always printed, even when logs are disabled.
    banner(message: string): void {
        console.info(`%c ${message} `, LOGGER_BANNER_STYLE)
    }

    #print(level: LogLevel, message: string, args: unknown[]): void {
        // Errors are always reported so production failures stay visible.
        // Info and warning logs are opt-in and gated by the `enabled` flag.
        if (level !== LOG_LEVEL.ERROR && !this.#enabled) {
            return
        }

        const parts = [`%c ${LOGGER_BADGE_LABEL} %c ${message}`, LOGGER_BADGE_STYLE, LOGGER_RESET_STYLE, ...args]

        switch (level) {
            case LOG_LEVEL.ERROR:
                console.error(...parts)
                break
            case LOG_LEVEL.WARN:
                console.warn(...parts)
                break
            default:
                console.info(...parts)
                break
        }
    }
}

export { Logger }
export default new Logger()
