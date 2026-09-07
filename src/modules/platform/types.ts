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

// Type-only dependency on the social module: claims are a social feature, but
// their launch-time status rides along with the launch data.
import type { ClaimStatus } from '../social/types'

// Structured data attached to the entity the game was launched from — a post,
// a shared link. `platform.payload` is its string counterpart. Platforms add
// their own fields (Reddit: postId, subredditName).
export interface LaunchData {
    id: string
    // Player who created the entity, when known.
    authorId: string | null
    // Arbitrary JSON attached in social.createPost({ data }); the game decides its meaning.
    data: unknown
    // Whether other players may social.claim() on this entity.
    claimable: boolean
    // Claim status of the current player, when the backend provides it.
    claim?: ClaimStatus
    [key: string]: unknown
}
