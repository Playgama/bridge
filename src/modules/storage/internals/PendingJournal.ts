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

import localStorage from '../../../lib/LocalStorage'
import { STORAGE_PENDING_KEY } from '../constants'

export interface PendingChanges {
    // Player the changes belong to; they are only ever sent to this player's cloud.
    playerId: string | null
    // key -> serialized value; null is a pending delete.
    data: Record<string, unknown>
}

// Changes not yet sent to the platform cloud, mirrored to local storage under a single key.
// Survives a crash or a closed tab, so the next session sends them; dropped once they are sent.
// Kept apart from the plain local storage keys, which hold guest data.
class PendingJournal {
    load(): PendingChanges | null {
        const raw = localStorage.getItem(STORAGE_PENDING_KEY)
        if (!raw) {
            return null
        }

        try {
            const parsed = JSON.parse(raw) as PendingChanges
            if (parsed && typeof parsed.data === 'object' && parsed.data !== null) {
                return { playerId: parsed.playerId ?? null, data: parsed.data }
            }
        } catch {
            // Corrupted journal — treated as empty.
        }
        return null
    }

    save(changes: PendingChanges): void {
        if (Object.keys(changes.data).length === 0) {
            this.clear()
            return
        }

        try {
            localStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(changes))
        } catch {
            // Quota exceeded — the changes are still in the runtime cache and get sent from there.
        }
    }

    clear(): void {
        localStorage.removeItem(STORAGE_PENDING_KEY)
    }
}

export default PendingJournal
