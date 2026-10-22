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

export const GOW_PROTOCOL_VERSION = '1.0'

export const GOW_MESSAGE_TYPE = {
    COMMAND: 'gow-command',
    ACK: 'gow-ack',
    STATE: 'game-state',
} as const

export const GOW_COMMAND = {
    PAUSE: 'pause',
    CONTINUE: 'continue',
    MUTE: 'mute',
    UNMUTE: 'unmute',
    GET_STATE: 'get-state',
} as const
export type GowCommand = typeof GOW_COMMAND[keyof typeof GOW_COMMAND]

export const GOW_STATE = {
    LOADING: 'loading',
    READY: 'ready',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game-over',
    ERROR: 'error',
    EXIT_REQUESTED: 'exit-requested',
    HOME: 'home',
    MENU: 'menu',
    LEVEL_COMPLETE: 'level-complete',
    EXITING: 'exiting',
} as const
export type GowState = typeof GOW_STATE[keyof typeof GOW_STATE]

export const GOW_DEDICATED_ACTION = {
    PAUSE: 'pause',
    MUTE: 'mute',
} as const
export type GowDedicatedAction = typeof GOW_DEDICATED_ACTION[keyof typeof GOW_DEDICATED_ACTION]

export interface GowCommandMessage {
    requestId: string | number
    command: GowCommand
}

export interface GowPendingCommands {
    isPaused: boolean
    isMuted: boolean
}
