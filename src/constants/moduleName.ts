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

export const MODULE_NAME = {
    CORE: 'core',
    PLATFORM: 'platform',
    PLAYER: 'player',
    STORAGE: 'storage',
    ADVERTISEMENT: 'advertisement',
    SOCIAL: 'social',
    DEVICE: 'device',
    LEADERBOARDS: 'leaderboards',
    PAYMENTS: 'payments',
    REMOTE_CONFIG: 'remote_config',
    CLIPBOARD: 'clipboard',
    ACHIEVEMENTS: 'achievements',
    ANALYTICS: 'analytics',
    DAILY_REWARDS: 'daily_rewards',
} as const
export type ModuleName = typeof MODULE_NAME[keyof typeof MODULE_NAME]
