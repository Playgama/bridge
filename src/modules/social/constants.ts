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

// How often the same player may receive a post reward: once per `cooldown`
// across all posts of the game, or once per `cooldown` per post.
export const POST_REWARD_SCOPE = {
    USER: 'user',
    POST: 'post',
} as const
export type PostRewardScope = typeof POST_REWARD_SCOPE[keyof typeof POST_REWARD_SCOPE]
