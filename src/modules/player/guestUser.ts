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

import localStorage from '../../lib/LocalStorage'
import { generateRandomId } from '../../utils/random'
import { GUEST_ID_STORAGE_KEY, LEGACY_GUEST_ID_STORAGE_KEY } from './constants'

export interface GuestUser {
    id: string
    name: string
}

let cachedId: string | null = null

export function getGuestUser(): GuestUser {
    if (cachedId) {
        return { id: cachedId, name: `Guest ${cachedId}` }
    }

    // Fall back to the SDK v1 key so existing guests keep their identity on upgrade.
    let id = localStorage.getItem(GUEST_ID_STORAGE_KEY)
        || localStorage.getItem(LEGACY_GUEST_ID_STORAGE_KEY)

    if (!id) {
        id = generateRandomId()
    }

    // Re-persist under the current key (migrates a legacy id, or stores a new one).
    try {
        localStorage.setItem(GUEST_ID_STORAGE_KEY, id)
    } catch {
        // ignore
    }

    cachedId = id

    return {
        id,
        name: `Guest ${id}`,
    }
}
