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

// Who a post reward is for: the player who came to the game through the post,
// or its author, once per player who came. A reward declared without a type is
// a visit reward.
export const POST_REWARD_TYPE = {
    VISIT: 'visit',
    AUTHOR: 'author',
} as const
export type PostRewardType = typeof POST_REWARD_TYPE[keyof typeof POST_REWARD_TYPE]

export const CONTENT_FIELDS = ['text', 'image', 'url'] as const
