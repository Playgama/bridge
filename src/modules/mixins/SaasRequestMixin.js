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

const SaasRequestMixin = (BaseClass) => class extends BaseClass {
    get baseUrl() {
        return this._platformBridge.options.saas.baseUrl || SAAS_URL
    }

    get xHeaders() {
        return {
            'x-player-id': this._platformBridge.playerId || '',
            'x-platform-id': this._platformBridge.platformId,
            'x-public-token': this._platformBridge.options.saas?.publicToken || '',
        }
    }

    get request() {
        return {
            get: this.#get.bind(this),
            post: this.#post.bind(this),
        }
    }

    async #get(url) {
        return fetch(`${this.baseUrl}/${url}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',

                ...this.xHeaders,
            },
        }).then((response) => response.json())
    }

    async #post(url, data) {
        return fetch(`${this.baseUrl}/${url}`, {
            method: 'POST',
            body: JSON.stringify(data),
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',

                ...this.xHeaders,
            },
        }).then((response) => response.json())
    }
}

export default SaasRequestMixin
