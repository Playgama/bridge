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

import type { JsonValue } from '../utils'

export const SAAS_URL = 'https://playgama.com/api/bridge/v1'

export interface SaasBridgeLike {
    playerId?: string | null
    platformId: string
    options: {
        saas?: {
            baseUrl?: string
            publicToken?: string
        }
        [key: string]: unknown
    }
}

export interface SaasRequestApi {
    get<T = unknown>(url: string): Promise<T>
    post<T = unknown>(url: string, data: JsonValue): Promise<T>
}

export default class SaasRequest {
    get baseUrl(): string {
        return this.#bridge.options.saas?.baseUrl || SAAS_URL
    }

    get xHeaders(): Record<string, string> {
        return {
            'x-player-id': this.#bridge.playerId || '',
            'x-platform-id': this.#bridge.platformId,
            'x-public-token': this.#bridge.options.saas?.publicToken || '',
        }
    }

    #bridge: SaasBridgeLike

    constructor(bridge: SaasBridgeLike) {
        this.#bridge = bridge
    }

    get<T = unknown>(url: string): Promise<T> {
        return fetch(`${this.baseUrl}/${url}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...this.xHeaders },
        }).then((response) => response.json() as Promise<T>)
    }

    post<T = unknown>(url: string, data: JsonValue): Promise<T> {
        return fetch(`${this.baseUrl}/${url}`, {
            method: 'POST',
            body: JSON.stringify(data),
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...this.xHeaders },
        }).then((response) => response.json() as Promise<T>)
    }
}
