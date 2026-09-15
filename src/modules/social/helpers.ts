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
import type { PlatformId } from '../platform/constants'
import { POST_REWARD_TYPE, CONTENT_FIELDS, type PostRewardType } from './constants'
import type {
    SocialConfig, SocialMethod, SocialOptions, SocialContentMapping, PostMapping, PostRewardConfig, PostReward,
} from './types'

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

// Builds what a social method called with an id sends to the platform SDK:
// the canonical content fields of the entry with the active platform's block
// on top, nothing else. Returns null when the id is not declared.
export function getSocialContent(
    entries: SocialContentMapping[] | undefined,
    platformId: PlatformId,
    id: string,
): AnyRecord | null {
    const entry = entries?.find((item) => item?.id === id)
    if (!entry) {
        return null
    }

    const content: AnyRecord = {}
    CONTENT_FIELDS.forEach((key) => {
        if (entry[key] !== undefined) {
            content[key] = entry[key]
        }
    })

    const platformData = entry[platformId]
    return platformData && typeof platformData === 'object'
        ? deepMerge(content, platformData as AnyRecord)
        : content
}

// Resolves a post declared in `social.posts` for the active platform, merging
// its block on top like a `platforms` block over the config. The module reads
// the rewards and the cooldown from it. Null when the id is not declared.
export function getPostPlatformData(
    posts: PostMapping[] | undefined,
    platformId: PlatformId,
    id: string,
): PostMapping | null {
    const entry = posts?.find((post) => post?.id === id)
    if (!entry) {
        return null
    }

    const platformData = entry[platformId]
    return platformData && typeof platformData === 'object'
        ? deepMerge(entry, platformData as AnyRecord)
        : entry
}

// Rewards of one post entry meant for one side. A reward declared without a
// type is for the player who came through the post; the author's ones are
// multiplied by how many players the platform backend counted.
export function getPostRewards(
    post: PostMapping | null,
    type: PostRewardType,
    count: number,
): PostReward[] {
    const rewards = (post?.rewards ?? []) as PostRewardConfig[]
    return rewards
        .filter((reward) => (reward.type ?? POST_REWARD_TYPE.VISIT) === type)
        .map(({ id, amount }) => ({ id, amount: amount * count, type }))
}
