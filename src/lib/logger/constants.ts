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

export const LOG_LEVEL = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
} as const

export type LogLevel = typeof LOG_LEVEL[keyof typeof LOG_LEVEL]

// Name shown inside the styled console badge.
export const LOGGER_BADGE_LABEL = 'PlaygamaBridge'

// Brand color used as the background of every styled console message.
export const LOGGER_BRAND_COLOR = '#9747FF'

// Styles for the `%c` formatted console badge.
export const LOGGER_BADGE_STYLE = `background: ${LOGGER_BRAND_COLOR}; color: #fff; padding: 1px 6px; border-radius: 4px`
export const LOGGER_RESET_STYLE = ''

// Style for the always-visible branded banner (e.g. the initialization notice).
export const LOGGER_BANNER_STYLE = `background: ${LOGGER_BRAND_COLOR}; color: white; padding: 1px 6px; border-radius: 4px`

// Query parameter that enables logs regardless of the config file value.
export const LOGS_QUERY_PARAM = 'logs'

// Module methods excluded from call logging — event emitter plumbing whose
// arguments (listener callbacks) only add noise to the console.
export const LOGGER_IGNORED_MODULE_METHODS: readonly string[] = ['on', 'off', 'once', 'emit']
