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

export interface BridgeError {
    message: string
}

export const ERROR: Record<
'SDK_NOT_INITIALIZED'
| 'STORAGE_NOT_SUPPORTED'
| 'STORAGE_NOT_AVAILABLE'
| 'STORAGE_QUOTA_EXCEEDED'
| 'GAME_PARAMS_NOT_FOUND'
| 'INVITE_FRIENDS_MESSAGE_LENGTH_ERROR',
BridgeError
> = {
    SDK_NOT_INITIALIZED: { message: 'Before using the SDK you must initialize it' },
    STORAGE_NOT_SUPPORTED: { message: 'Storage not supported' },
    STORAGE_NOT_AVAILABLE: { message: 'Storage not available' },
    STORAGE_QUOTA_EXCEEDED: { message: 'Storage quota exceeded' },
    GAME_PARAMS_NOT_FOUND: { message: 'Game params are not found' },
    INVITE_FRIENDS_MESSAGE_LENGTH_ERROR: { message: 'Message is too long' },
}
