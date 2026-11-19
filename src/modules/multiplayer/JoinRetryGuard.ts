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

import { BridgeError, type ErrorCode } from '../../constants/errors'
import logger from '../../lib/logger'
import { JOIN_RETRY } from './constants'

interface JoinFailure {
    roomId: string
    code: ErrorCode
    count: number
    retryAt: number
}

// Games may retry joinRoom() in a loop on a full or missing room. Repeats to the
// last failed room get its error back without a request until the delay passes.
class JoinRetryGuard {
    #failure: JoinFailure | null = null

    // Throws the last error while the room is still cooling down.
    check(roomId: string): void {
        const failure = this.#failure
        if (failure && failure.roomId === roomId && Date.now() < failure.retryAt) {
            logger.warn('[multiplayer] joinRoom() was repeated too soon, the last error is returned:', failure.code)
            throw new BridgeError(failure.code)
        }
    }

    succeeded(): void {
        this.#failure = null
    }

    failed(roomId: string, error: unknown): void {
        if (!(error instanceof BridgeError) || !JOIN_RETRY.ERRORS.includes(error.code)) {
            return
        }

        const previous = this.#failure
        const count = previous?.roomId === roomId && previous.code === error.code ? previous.count + 1 : 1
        const delay = Math.min(JOIN_RETRY.BASE_DELAY * 2 ** (count - 1), JOIN_RETRY.MAX_DELAY)
        this.#failure = {
            roomId,
            code: error.code,
            count,
            retryAt: Date.now() + delay,
        }
    }
}

export default JoinRetryGuard
