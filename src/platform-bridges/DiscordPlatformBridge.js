/* eslint-disable camelcase */
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

import PlatformBridgeBase from './PlatformBridgeBase'
import { addJavaScript, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
} from '../constants'

const SDK_URL = 'https://discord.playgama.com/sdk.js'
const APPLICATION_SERVER_PROXY_URL = '/.proxy/api/token'

const scope = [
    'identify',
    'guilds',
    'applications.commands',
]

class DiscordPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.DISCORD
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    get isPlayerAuthorized() {
        return this._isPlayerAuthorized
    }

    _accessToken = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (
                !this.options?.appId
            ) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.DISCORD_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                addJavaScript(SDK_URL).then(() => {
                    waitFor('discord', 'DiscordSDK')
                        .then(() => {
                            this._platformSdk = new window.discord.DiscordSK(this.options.appId)
                            return this._platformSdk.ready()
                        })
                        .then(() => {
                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                })
            }
        }

        return promiseDecorator.promise
    }

    authorizePlayer() {
        if (!this._isInitialized) {
            return Promise.reject(ERROR.SDK_NOT_INITIALIZED)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.commands.authorize({
                client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
                response_type: 'code',
                state: '',
                prompt: 'none',
                scope,
            })
                .then(({ code }) => fetch(APPLICATION_SERVER_PROXY_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code,
                    }),
                }))
                .then((response) => response.json())
                .then(({ access_token }) => this._platformSdk.commands.authenticate({
                    access_token,
                }))
                .then((auth) => {
                    if (auth === null) {
                        throw new Error('Authorization failed')
                    }

                    this._accessToken = auth.access_token
                    this._isPlayerAuthorized = true
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(
                        ACTION_NAME.AUTHORIZE_PLAYER,
                        error,
                    )
                })
        }

        return promiseDecorator.promise
    }
}

export default DiscordPlatformBridge
