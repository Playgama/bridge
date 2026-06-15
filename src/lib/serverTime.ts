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

import ServerTimeCache from './ServerTimeCache'

export const TIMESTAMP_URL = 'https://api.playgama.com/api/bridge/v1/timestamp/now'

async function fetchServerTimestamp(): Promise<number> {
    const response = await fetch(TIMESTAMP_URL)
    if (!response.ok) {
        throw new Error('Network response was not ok')
    }

    const data = await response.json() as { timestamp: number }
    return data.timestamp * 1000
}

// Shared session-wide cache: the timestamp endpoint is requested only once.
export const serverTimeCache = new ServerTimeCache(fetchServerTimestamp)
