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

export const DEVICE_TYPE = {
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
    TABLET: 'tablet',
    TV: 'tv',
} as const
export type DeviceType = typeof DEVICE_TYPE[keyof typeof DEVICE_TYPE]

export const DEVICE_OS = {
    WINDOWS: 'windows',
    MACOS: 'macos',
    LINUX: 'linux',
    ANDROID: 'android',
    IOS: 'ios',
    OTHER: 'other',
} as const
export type DeviceOs = typeof DEVICE_OS[keyof typeof DEVICE_OS]

export const DEVICE_ORIENTATION = {
    PORTRAIT: 'portrait',
    LANDSCAPE: 'landscape',
} as const
export type DeviceOrientation = typeof DEVICE_ORIENTATION[keyof typeof DEVICE_ORIENTATION]

export const ORIENTATION_OVERLAY_ID = 'bridge-orientation-overlay'
