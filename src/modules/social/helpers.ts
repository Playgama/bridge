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
import { PLATFORM_ID, type PlatformId } from '../platform/constants'
import type {
    SocialConfig, SocialMethod, SocialOptions, PostMapping,
} from './types'

const PLATFORM_IDS = new Set<string>(Object.values(PLATFORM_ID))

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

// Builds the data of a post declared in the config `posts` array: the common
// fields of the entry with the active platform's own block merged on top, and
// every other platform's block dropped. Returns null when the id is unknown,
// which is how the modules tell "this post is not declared" from "declared but
// empty". The `id` is kept, so the game can branch on platform.data.id.
export function getPostPlatformData(
    posts: PostMapping[] | undefined,
    platformId: PlatformId,
    id: string,
): PostMapping | null {
    const entry = posts?.find((post) => post?.id === id)
    if (!entry) {
        return null
    }

    const common: AnyRecord = {}
    let platformData: AnyRecord = {}
    Object.keys(entry).forEach((key) => {
        const value = (entry as AnyRecord)[key]
        if (!PLATFORM_IDS.has(key)) {
            common[key] = value
            return
        }

        if (key === platformId && value && typeof value === 'object') {
            platformData = value as AnyRecord
        }
    })

    return deepMerge(common, platformData) as PostMapping
}
