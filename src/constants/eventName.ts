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

export const EVENT_NAME = {
    INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed',
    REWARDED_STATE_CHANGED: 'rewarded_state_changed',
    BANNER_STATE_CHANGED: 'banner_state_changed',
    ADVANCED_BANNERS_STATE_CHANGED: 'advanced_banners_state_changed',
    AUDIO_STATE_CHANGED: 'audio_state_changed',
    PAUSE_STATE_CHANGED: 'pause_state_changed',
    ORIENTATION_STATE_CHANGED: 'orientation_state_changed',
    SCREEN_SIZE_CHANGED: 'screen_size_changed',
    PLATFORM_MESSAGE_SENT: 'platform_message_sent',
    PLATFORM_STORAGE_AVAILABILITY_CHANGED: 'platform_storage_availability_changed',
} as const
export type EventName = typeof EVENT_NAME[keyof typeof EVENT_NAME]
