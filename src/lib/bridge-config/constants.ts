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

export const REMOTE_CONFIG_CACHE_STORAGE_KEY = 'bridge-remote-config-cache'
export const REMOTE_CONFIG_DEFAULT_TIMEOUT = 2000
export const REMOTE_CONFIG_DEFAULT_TTL = 60 * 60 * 1000

// Fields whose source is the local build/distribution and which must never
// be overridden by a remotely fetched bridge config. Includes bootstrap
// fields for the remote loader itself — otherwise a bad remote response
// could disable remote control of subsequent loads.
export const LOCAL_ONLY_CONFIG_FIELDS = [
    'forciblySetPlatformId',
    'remoteConfigUrl',
] as const
