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

export const SUBSCRIBE_NOTIFICATION_TYPE = {
    ROLL: 'roll',
    BOUNCE: 'bounce',
} as const
export type SubscribeNotificationType = typeof SUBSCRIBE_NOTIFICATION_TYPE[keyof typeof SUBSCRIBE_NOTIFICATION_TYPE]

export const SUBSCRIBE_NOTIFICATION_ROLL_ID = 'bridge-youtube-subscribe'
export const SUBSCRIBE_NOTIFICATION_ROLL_STYLES_ID = 'bridge-youtube-subscribe-styles'
export const SUBSCRIBE_NOTIFICATION_BOUNCE_ID = 'bridge-youtube-subscribe-bounce'
export const SUBSCRIBE_NOTIFICATION_BOUNCE_STYLES_ID = 'bridge-youtube-subscribe-bounce-styles'
