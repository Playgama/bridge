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

// How often the same player may claim on a post: once per `cooldown` per post,
// or once per `cooldown` across all claimable posts of the game.
export const CLAIM_SCOPE = {
    USER: 'user',
    POST: 'post',
} as const
export type ClaimScope = typeof CLAIM_SCOPE[keyof typeof CLAIM_SCOPE]

export const CLAIM_REASON = {
    UNAUTHORIZED: 'unauthorized',
    OWN: 'own',
    COOLDOWN: 'cooldown',
    EXPIRED: 'expired',
    LIMIT: 'limit',
} as const
export type ClaimReason = typeof CLAIM_REASON[keyof typeof CLAIM_REASON]
