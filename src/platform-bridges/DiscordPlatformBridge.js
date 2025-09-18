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
import { addJavaScript, deformatPrice, waitFor } from '../common/utils'
import { ACTION_NAME, ERROR, PLATFORM_ID } from '../constants'

const SDK_URL = '/cdn/discord/discord-v2.0.0.min.js'
const APPLICATION_SERVER_PROXY_URL = '/api'

class DiscordPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.DISCORD
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    _appId = null

    _accessToken = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.appId) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.DISCORD_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this._appId = this._options.appId

                addJavaScript(SDK_URL).then(() => {
                    waitFor('discord', 'DiscordSDK')
                        .then(() => {
                            this._platformSdk = new window.discord.DiscordSDK(this._appId)
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

    // player
    authorizePlayer(options) {
        const scope = options?.scope || ['identify']

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.commands.authorize({
                client_id: this._appId,
                response_type: 'code',
                state: '',
                prompt: 'none',
                scope,
            })
                .then(({ code }) => fetch(`${APPLICATION_SERVER_PROXY_URL}/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code,
                    }),
                }))
                .then((response) => response.json())
                .then((data) => {
                    this._accessToken = data.access_token

                    this._playerExtra = {
                        token: data.token,
                        accessToken: this._accessToken,
                        channelId: this._platformSdk.channelId,
                    }

                    return this._platformSdk.commands.authenticate({
                        access_token: this._accessToken,
                    })
                })
                .then((auth) => {
                    if (auth === null) {
                        this._playerApplyGuestData()
                        throw new Error('Authorization failed')
                    }

                    this._isPlayerAuthorized = true
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

                    return fetch('/users/@me', {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${this._accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    })
                })
                .then((response) => response.json())
                .then((user) => {
                    this._playerId = user.id
                    this._playerName = user.username
                    if (user.avatar) {
                        this._playerPhotos.push(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`)
                    }

                    this._playerExtra = {
                        ...this._playerExtra,
                        ...user,
                    }
                })
                .catch((error) => {
                    this._playerApplyGuestData()
                    this._accessToken = null

                    this._rejectPromiseDecorator(
                        ACTION_NAME.AUTHORIZE_PLAYER,
                        error,
                    )
                })
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.commands.startPurchase({ sku_id: product.platformProductId })
                .then((purchase) => {
                    if (!purchase) {
                        throw new Error('Purchase failed')
                    }

                    const mergedPurchase = { id, ...purchase }
                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            fetch(`/applications/${this._appId}/entitlements/${this._paymentsPurchases[purchaseIndex].purchaseToken}/consume`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this._accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })
                .then(() => {
                    this._paymentsPurchases.splice(purchaseIndex, 1)
                    this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.commands.getSkus()
                .then(({ skus: discordProducts }) => {
                    const mergedProducts = products.map((product) => {
                        const discordProduct = discordProducts.find((p) => p.id === product.platformProductId)

                        const formattedPrice = window.discord.PriceUtils.formatPrice(discordProduct.price)
                        const priceValue = deformatPrice(formattedPrice)
                        const priceCurrencyCode = discordProduct.price?.currency?.toUpperCase()
                        const price = `${priceValue} ${priceCurrencyCode}`

                        return {
                            id: product.id,
                            title: discordProduct.name,
                            price,
                            priceValue,
                            priceCurrencyCode,
                        }
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.commands.getEntitlements()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.entitlements.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.id)
                        return {
                            id: product.id,
                            ...purchase,
                        }
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    // social
    inviteFriends() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this._platformSdk.commands.openInviteDialog()
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, error)
                })
        }

        return promiseDecorator.promise
    }

    share(options) {
        if (!options.mediaUrl) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this._platformSdk.commands.openShareMomentDialog({
                mediaUrl: options.mediaUrl,
            })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }
}

export default DiscordPlatformBridge
