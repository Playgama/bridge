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

import { deepMerge, type AnyRecord } from '../../utils'
import type { SocialConfig, SocialMethod, SocialOptions } from './types'

// Builds the data a social method receives: the static config block for the method
// merged with the game's runtime options on top. The config block is already
// platform-resolved by the config loader — common values live in the top-level
// `social[method]` block and platform-specific overrides in the active platform's
// `platforms[id].social[method]`, which the loader deep-merges before the module
// reads it. So there is no platform key here. Runtime values win, so the game can
// override config defaults with dynamic content (a result screenshot, a score).
export function getSocialPlatformData(
    social: SocialConfig | undefined,
    method: SocialMethod,
    runtimeOptions?: SocialOptions,
): AnyRecord {
    const configData = social?.[method]
    const base: AnyRecord = configData && typeof configData === 'object' ? configData : {}
    const runtime: AnyRecord = runtimeOptions ?? {}
    return deepMerge(base, runtime)
}
