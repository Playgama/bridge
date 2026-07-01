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

import { PLATFORM_ID } from '../modules/platform/constants'

// Default origin for every Playgama backend call (analytics, server time, SaaS).
export const API_ORIGIN = 'https://api.playgama.com'

// Discord Activities run in a sandboxed iframe where direct requests to
// external origins are blocked by CSP. All backend calls must instead go
// through Discord's URL-mapping proxy, which is configured under the
// `/playgama` prefix in the Discord Developer Portal. Using a relative origin
// makes the browser hit `<activity-host>/playgama/...`, which Discord proxies
// to `api.playgama.com/...`.
export const DISCORD_API_ORIGIN = '/playgama'

// Single source of truth for the API origin of the active platform. Every
// backend URL is built as `${resolveApiOrigin(platformId)}${path}`.
export function resolveApiOrigin(platformId: string): string {
    return platformId === PLATFORM_ID.DISCORD ? DISCORD_API_ORIGIN : API_ORIGIN
}
