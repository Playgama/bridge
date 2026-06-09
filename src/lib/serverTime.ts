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
import { SAAS_URL } from './SaasRequest'

export const TIMESTAMP_PATH = 'timestamp'

/**
 * Fetches the server time (in milliseconds) from the SaaS timestamp endpoint.
 * This is a public endpoint: only the SaaS base URL is reused — no auth token,
 * SaaS headers, or credentials are sent.
 */
export async function fetchSaasServerTime(baseUrl: string = SAAS_URL): Promise<number> {
    const response = await fetch(`${baseUrl}/${TIMESTAMP_PATH}`)
    if (!response.ok) {
        throw new Error('Network response was not ok')
    }

    const data = await response.json() as { timestamp?: number }
    if (typeof data?.timestamp !== 'number' || !Number.isFinite(data.timestamp)) {
        throw new Error('Invalid timestamp response')
    }

    return data.timestamp
}

/**
 * Builds a per-bridge cache that resolves the SaaS base URL lazily (on first
 * retrieval), so a config override is respected even though it is applied after
 * construction. The endpoint is requested only once per session.
 */
export function createSaasServerTimeCache(
    getBaseUrl: () => string | undefined | null,
): ServerTimeCache {
    return new ServerTimeCache(() => fetchSaasServerTime(getBaseUrl() || SAAS_URL))
}
