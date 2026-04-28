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

import { SAAS_URL } from '../../constants'
import type { JsonValue } from '../../types/common'

export interface SaasPlatformBridgeLike {
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

export interface SaasRequestMixed {
    readonly baseUrl: string
    readonly xHeaders: Record<string, string>
    readonly request: SaasRequestApi
}

// Constructor type tolerant to protected `_platformBridge`. We re-declare the
// expected access in the mixin body so the mixed class can read it directly.
type Constructor<T = object> = new (...args: any[]) => T

const SaasRequestMixin = <TBase extends Constructor>(BaseClass: TBase) => {
    class SaasRequestMixed extends BaseClass {
    // Re-declared so the mixin body can access it. The actual storage
        get baseUrl(): string {
            return this._platformBridge.options.saas?.baseUrl || SAAS_URL
        }

        get xHeaders(): Record<string, string> {
            return {
                'x-player-id': this._platformBridge.playerId || '',
                'x-platform-id': this._platformBridge.platformId,
                'x-public-token': this._platformBridge.options.saas?.publicToken || '',
            }
        }

        get request(): SaasRequestApi {
            return {
                get: this.#get.bind(this),
                post: this.#post.bind(this),
            }
        }

        // lives on the base class; this is only a type annotation.
        protected _platformBridge!: SaasPlatformBridgeLike

        async #get<T = unknown>(url: string): Promise<T> {
            return fetch(`${this.baseUrl}/${url}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',

                    ...this.xHeaders,
                },
            }).then((response) => response.json() as Promise<T>)
        }

        async #post<T = unknown>(url: string, data: JsonValue): Promise<T> {
            return fetch(`${this.baseUrl}/${url}`, {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',

                    ...this.xHeaders,
                },
            }).then((response) => response.json() as Promise<T>)
        }
    }

    return SaasRequestMixed
}

export default SaasRequestMixin
