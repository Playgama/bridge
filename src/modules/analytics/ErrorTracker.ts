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

import { hashString } from '../../utils/string'
import { LOGGER_BADGE_LABEL } from '../../lib/logger/constants'
import {
    GAME_ERROR_TYPE,
    ERROR_TRACKING_SAMPLE_RATE,
    ERROR_TRACKING_MAX_UNIQUE,
    ERROR_TRACKING_MAX_TOTAL,
    ERROR_MESSAGE_MAX_LENGTH,
    ERROR_STACK_MAX_LENGTH,
    ERROR_STACK_MAX_LINES,
    ERROR_ARGUMENT_MAX_LENGTH,
    ERROR_IGNORED_MESSAGES,
    ERROR_IGNORED_SOURCES,
} from './constants'
import type { CapturedGameError, GameError, GameErrorType } from './types'

type ConsoleMethod = (...args: unknown[]) => void

type GameErrorDetails = Omit<GameError, 'fingerprint'>

interface ErrorRecord {
    error: GameError
    timestamp: number
    count: number
}

// Drops the query and the hash of every URL: they may carry tokens
const URL_QUERY_PATTERN = /(\b[a-z][\w+.-]*:\/\/[^\s?#)]+)[?#][^\s):]*/gi

// First "url:line:col" in a stack, Chrome and Firefox formats
const STACK_FRAME_PATTERN = /((?:https?|blob|file):\/\/[^\s)]+?):(\d+):(\d+)/

const LOGGER_MESSAGE_PREFIX = `%c ${LOGGER_BADGE_LABEL} `

function sanitize(value: string, maxLength: number): string {
    return value.replace(URL_QUERY_PATTERN, '$1').slice(0, maxLength)
}

function describeError(error: Error): string {
    return error.message ? `${error.name}: ${error.message}` : error.name
}

function stringifyArgument(value: unknown): string {
    if (typeof value === 'string') {
        return value
    }

    if (value instanceof Error) {
        return describeError(value)
    }

    if (value !== null && typeof value === 'object') {
        try {
            return JSON.stringify(value).slice(0, ERROR_ARGUMENT_MAX_LENGTH)
        } catch {
            return String(value)
        }
    }

    return String(value)
}

function getStack(value: unknown): string {
    return value instanceof Error && typeof value.stack === 'string' ? value.stack : ''
}

function buildDetails(
    type: GameErrorType,
    message: string,
    stack: string,
    location?: { source: string, line: number, col: number },
): GameErrorDetails {
    const frame = location?.source ? null : stack.match(STACK_FRAME_PATTERN)

    return {
        type,
        message: sanitize(message, ERROR_MESSAGE_MAX_LENGTH),
        stack: sanitize(stack.split('\n').slice(0, ERROR_STACK_MAX_LINES).join('\n'), ERROR_STACK_MAX_LENGTH),
        source: sanitize(location?.source || frame?.[1] || '', ERROR_MESSAGE_MAX_LENGTH),
        line: location?.line || Number(frame?.[2] ?? 0),
        col: location?.col || Number(frame?.[3] ?? 0),
    }
}

// Catches the game errors: uncaught exceptions, unhandled rejections,
// failed resource loads and console.error calls, and counts the repeats
class ErrorTracker {
    get hasPending(): boolean {
        return Array.from(this.#records.values()).some((record) => record.count > 0)
    }

    #records = new Map<string, ErrorRecord>()

    #totalCount = 0

    #isInstalled = false

    #isConsoleCaptured = false

    #isCapturing = false

    #originalConsoleError: ConsoleMethod | null = null

    #consoleErrorWrapper: ConsoleMethod | null = null

    #onNewError: (() => void) | null = null

    #errorHandler = (event: Event): void => this.#handleErrorEvent(event)

    #rejectionHandler = (event: PromiseRejectionEvent): void => this.#handleRejection(event)

    // Called as early as possible so the errors thrown before the bridge initialization are kept
    install(): void {
        if (this.#isInstalled || typeof window === 'undefined') {
            return
        }

        this.#isInstalled = true
        window.addEventListener('error', this.#errorHandler, true)
        window.addEventListener('unhandledrejection', this.#rejectionHandler)
        this.#wrapConsole()
    }

    configure(isEnabled: boolean, onNewError: () => void): void {
        if (!isEnabled || Math.random() >= ERROR_TRACKING_SAMPLE_RATE) {
            this.#uninstall()
            this.#records.clear()
            return
        }

        this.install()
        this.#onNewError = onNewError

        if (this.hasPending) {
            onNewError()
        }
    }

    // Returns the errors counted since the previous call
    drain(): CapturedGameError[] {
        const errors: CapturedGameError[] = []

        this.#records.forEach((record) => {
            if (record.count > 0) {
                errors.push({ ...record.error, timestamp: record.timestamp, count: record.count })
                record.count = 0 // eslint-disable-line no-param-reassign
            }
        })

        return errors
    }

    #uninstall(): void {
        if (!this.#isInstalled) {
            return
        }

        this.#isInstalled = false
        this.#onNewError = null
        window.removeEventListener('error', this.#errorHandler, true)
        window.removeEventListener('unhandledrejection', this.#rejectionHandler)
        this.#restoreConsole()
    }

    #wrapConsole(): void {
        if (typeof console === 'undefined' || typeof console.error !== 'function') {
            return
        }

        const original = console.error
        const wrapper: ConsoleMethod = (...args) => {
            original.apply(console, args)

            if (this.#isConsoleCaptured) {
                this.#handleConsoleError(args)
            }
        }

        this.#originalConsoleError = original
        this.#consoleErrorWrapper = wrapper
        this.#isConsoleCaptured = true
        console.error = wrapper
    }

    #restoreConsole(): void {
        this.#isConsoleCaptured = false

        // Another script may have wrapped it after us, then the wrapper just stays inactive
        if (this.#originalConsoleError && console.error === this.#consoleErrorWrapper) {
            console.error = this.#originalConsoleError
        }

        this.#originalConsoleError = null
        this.#consoleErrorWrapper = null
    }

    #handleErrorEvent(event: Event): void {
        const { target } = event

        if (target instanceof Element) {
            const url = (target as Partial<HTMLScriptElement>).src || (target as Partial<HTMLLinkElement>).href
            if (typeof url === 'string' && url) {
                const message = `Failed to load ${target.tagName.toLowerCase()}: ${url}`
                this.#capture(buildDetails(GAME_ERROR_TYPE.RESOURCE, message, '', { source: url, line: 0, col: 0 }))
            }
            return
        }

        if (!(event instanceof ErrorEvent)) {
            return
        }

        const { error } = event
        const message = event.message || (error instanceof Error ? describeError(error) : '')

        this.#capture(buildDetails(GAME_ERROR_TYPE.ERROR, message, getStack(error), {
            source: event.filename,
            line: event.lineno,
            col: event.colno,
        }))
    }

    #handleRejection(event: PromiseRejectionEvent): void {
        const { reason } = event
        const message = reason instanceof Error
            ? describeError(reason)
            : `Unhandled rejection: ${stringifyArgument(reason)}`

        this.#capture(buildDetails(GAME_ERROR_TYPE.REJECTION, message, getStack(reason)))
    }

    #handleConsoleError(args: unknown[]): void {
        if (typeof args[0] === 'string' && args[0].startsWith(LOGGER_MESSAGE_PREFIX)) {
            return
        }

        const error = args.find((arg) => arg instanceof Error)
        const message = args.map(stringifyArgument).join(' ')

        this.#capture(buildDetails(GAME_ERROR_TYPE.CONSOLE, message, getStack(error)))
    }

    #capture(details: GameErrorDetails): void {
        if (this.#isCapturing || this.#totalCount >= ERROR_TRACKING_MAX_TOTAL || !details.message) {
            return
        }

        if (ERROR_IGNORED_MESSAGES.some((pattern) => pattern.test(details.message))
            || ERROR_IGNORED_SOURCES.some((pattern) => pattern.test(details.source))) {
            return
        }

        this.#isCapturing = true

        try {
            const normalizedMessage = details.message.replace(/\d+/g, '#')
            const fingerprint = hashString(
                `${details.type}|${normalizedMessage}|${details.source}:${details.line}:${details.col}`,
            )

            const record = this.#records.get(fingerprint)
            if (record) {
                if (record.count === 0) {
                    record.timestamp = Date.now()
                }
                record.count += 1
                this.#totalCount += 1
                return
            }

            if (this.#records.size >= ERROR_TRACKING_MAX_UNIQUE) {
                return
            }

            this.#totalCount += 1
            this.#records.set(fingerprint, {
                error: { ...details, fingerprint },
                timestamp: Date.now(),
                count: 1,
            })
            this.#onNewError?.()
        } catch {
            // Error tracking must never break the game
        } finally {
            this.#isCapturing = false
        }
    }
}

export { ErrorTracker }
export default new ErrorTracker()
