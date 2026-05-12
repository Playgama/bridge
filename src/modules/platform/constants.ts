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

export const PLATFORM_ID = {
    VK: 'vk',
    OK: 'ok',
    YANDEX: 'yandex',
    CRAZY_GAMES: 'crazy_games',
    ABSOLUTE_GAMES: 'absolute_games',
    GAME_DISTRIBUTION: 'game_distribution',
    PLAYGAMA: 'playgama',
    PLAYDECK: 'playdeck',
    TELEGRAM: 'telegram',
    Y8: 'y8',
    LAGGED: 'lagged',
    FACEBOOK: 'facebook',
    POKI: 'poki',
    MOCK: 'mock',
    QA_TOOL: 'qa_tool',
    MSN: 'msn',
    MICROSOFT_STORE: 'microsoft_store',
    HUAWEI: 'huawei',
    BITQUEST: 'bitquest',
    GAMEPUSH: 'gamepush',
    DISCORD: 'discord',
    JIO_GAMES: 'jio_games',
    YOUTUBE: 'youtube',
    PORTAL: 'portal',
    REDDIT: 'reddit',
    XIAOMI: 'xiaomi',
    TIKTOK: 'tiktok',
    DLIGHTEK: 'dlightek',
    GAMESNACKS: 'gamesnacks',
} as const
export type PlatformId = typeof PLATFORM_ID[keyof typeof PLATFORM_ID]

export const PLATFORM_MESSAGE = {
    GAME_READY: 'game_ready',
    LEVEL_STARTED: 'level_started',
    LEVEL_COMPLETED: 'level_completed',
    LEVEL_FAILED: 'level_failed',
    LEVEL_PAUSED: 'level_paused',
    LEVEL_RESUMED: 'level_resumed',
    IN_GAME_LOADING_STARTED: 'in_game_loading_started',
    IN_GAME_LOADING_STOPPED: 'in_game_loading_stopped',
    GAMEPLAY_STARTED: 'gameplay_started',
    GAMEPLAY_STOPPED: 'gameplay_stopped',
    PLAYER_GOT_ACHIEVEMENT: 'player_got_achievement',
} as const
export type PlatformMessage = typeof PLATFORM_MESSAGE[keyof typeof PLATFORM_MESSAGE]

export const VISIBILITY_STATE = {
    VISIBLE: 'visible',
    HIDDEN: 'hidden',
} as const
export type VisibilityState = typeof VISIBILITY_STATE[keyof typeof VISIBILITY_STATE]
