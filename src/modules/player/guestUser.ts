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

import { generateRandomId } from '../../utils/random'
import { GUEST_ID_STORAGE_KEY } from './constants'

export interface GuestUser {
    id: string
    name: string
}

export function getGuestUser(): GuestUser {
    let id: string | null = null

    try {
        id = localStorage.getItem(GUEST_ID_STORAGE_KEY)
    } catch {
        // ignore
    }

    if (!id) {
        id = generateRandomId()

        try {
            localStorage.setItem(GUEST_ID_STORAGE_KEY, id)
        } catch {
            // ignore
        }
    }

    return {
        id,
        name: `Guest ${id}`,
    }
}
