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

export const ANALYTICS_PATH = '/api/events/v3/bridge/analytics'
export const FLUSH_INTERVAL = 30000

export const CUSTOM_EVENTS_QUEUE_LIMIT = 1000

export const GAMEPLAY_MILESTONES_SECONDS = [30, 60] as const

export const GAME_ERROR_TYPE = {
    ERROR: 'error',
    REJECTION: 'rejection',
    CONSOLE: 'console',
    RESOURCE: 'resource',
} as const

// Share of sessions that report game errors, from 0 to 1
export const ERROR_TRACKING_SAMPLE_RATE = 1

// Delay before the errors are sent after a new one is caught: the game often freezes right after it
export const ERROR_FLUSH_DELAY = 3000

// Per-session limits: distinct errors, and all occurrences including repeats
export const ERROR_TRACKING_MAX_UNIQUE = 20
export const ERROR_TRACKING_MAX_TOTAL = 200

// Errors kept for a retry when sending fails
export const ERROR_QUEUE_LIMIT = 100

// Browsers reject keepalive requests and beacons with a body over 64 KB, a margin is left for headers
export const KEEPALIVE_BODY_LIMIT = 60 * 1024

export const ERROR_MESSAGE_MAX_LENGTH = 500
export const ERROR_STACK_MAX_LENGTH = 2000
export const ERROR_STACK_MAX_LINES = 10
export const ERROR_ARGUMENT_MAX_LENGTH = 200

// Errors without any useful details or not caused by the game
export const ERROR_IGNORED_MESSAGES: readonly RegExp[] = [
    /^Script error\.?$/i,
    /ResizeObserver loop/i,
]

export const ERROR_IGNORED_SOURCES: readonly RegExp[] = [
    /(chrome|moz|safari|safari-web)-extension:\/\//i,
]
