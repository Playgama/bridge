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

export const ERROR_CODE = {
    SDK_NOT_INITIALIZED: 'SDK_NOT_INITIALIZED',
    INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
    CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
    CONFIG_PARSE_FAILED: 'CONFIG_PARSE_FAILED',
    STORAGE_NOT_SUPPORTED: 'STORAGE_NOT_SUPPORTED',
    STORAGE_NOT_AVAILABLE: 'STORAGE_NOT_AVAILABLE',
    STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
    GAME_PARAMS_NOT_FOUND: 'GAME_PARAMS_NOT_FOUND',
    INVITE_FRIENDS_MESSAGE_LENGTH_ERROR: 'INVITE_FRIENDS_MESSAGE_LENGTH_ERROR',
    NOTIFICATIONS_NOT_SUPPORTED: 'NOTIFICATIONS_NOT_SUPPORTED',
    NOTIFICATION_INVALID_PARAMETERS: 'NOTIFICATION_INVALID_PARAMETERS',
} as const

export type ErrorCode = typeof ERROR_CODE[keyof typeof ERROR_CODE]

const ERROR_MESSAGES: Record<ErrorCode, string> = {
    SDK_NOT_INITIALIZED: 'Before using the SDK you must initialize it',
    INITIALIZATION_FAILED: 'SDK initialization failed',
    CONFIG_LOAD_FAILED: 'Failed to load the bridge config file',
    CONFIG_PARSE_FAILED: 'Failed to parse the bridge config file',
    STORAGE_NOT_SUPPORTED: 'Storage not supported',
    STORAGE_NOT_AVAILABLE: 'Storage not available',
    STORAGE_QUOTA_EXCEEDED: 'Storage quota exceeded',
    GAME_PARAMS_NOT_FOUND: 'Game params are not found',
    INVITE_FRIENDS_MESSAGE_LENGTH_ERROR: 'Message is too long',
    NOTIFICATIONS_NOT_SUPPORTED: 'Notifications not supported',
    NOTIFICATION_INVALID_PARAMETERS: 'Invalid notification parameters',
}

export class BridgeError extends Error {
    readonly code: ErrorCode

    // Underlying error that caused this one, when the failure is wrapped.
    readonly originalError?: unknown

    constructor(code: ErrorCode, originalError?: unknown) {
        super(ERROR_MESSAGES[code])
        this.name = 'BridgeError'
        this.code = code
        this.originalError = originalError
    }
}

// Back-compat shim: external code may still read ERROR.X.message.
// Each entry now exposes both `code` (for new code) and `message` (legacy).
export const ERROR: Record<ErrorCode, { code: ErrorCode; message: string }> = Object.fromEntries(
    (Object.keys(ERROR_CODE) as ErrorCode[]).map((key) => [
        key,
        { code: key, message: ERROR_MESSAGES[key] },
    ]),
) as Record<ErrorCode, { code: ErrorCode; message: string }>
