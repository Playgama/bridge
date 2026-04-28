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
import {
    ACTION_NAME,
    ERROR,
    PLATFORM_ID,
    type PlatformId,
} from '../constants'
import type { AnyRecord } from '../types/common'

const SDK_URL = '/cdn/discord/discord-v2.0.0.min.js'
const APPLICATION_SERVER_PROXY_URL = '/api'
const DISCORD_BASE_URL = 'https://discord.com/api/v10'

interface DiscordPurchase {
    id: string | number
    purchaseToken?: string
    [key: string]: unknown
}

interface DiscordSku {
    id: string
    name: string
    price: { currency?: string }
}

interface DiscordSdkInstance {
    channelId: string | null
    ready(): Promise<unknown>
    commands: {
        authorize(options: AnyRecord): Promise<{ code: string }>
        authenticate(options: { access_token: string }): Promise<unknown>
        startPurchase(options: { sku_id: string }): Promise<unknown>
        getSkus(): Promise<{ skus: DiscordSku[] }>
        getEntitlements(): Promise<{ entitlements: DiscordPurchase[] }>
        openInviteDialog(): Promise<unknown>
        openShareMomentDialog(options: { mediaUrl: string }): Promise<unknown>
    }
}

interface DiscordGlobal {
    DiscordSDK: new (appId: string) => DiscordSdkInstance
    PriceUtils: {
        formatPrice(price: { currency?: string } | undefined): string
    }
}

declare global {
    interface Window {
        discord?: DiscordGlobal
    }
}

class DiscordPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.DISCORD
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    // social
    get isInviteFriendsSupported(): boolean {
        return true
    }

    get isShareSupported(): boolean {
        return true
    }

    protected _appId: string | null = null

    protected _accessToken: string | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.appId) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    (ERROR as AnyRecord).DISCORD_GAME_PARAMS_NOT_FOUND,
                )
            } else {
                this._appId = this._options.appId as string

                addJavaScript(SDK_URL).then(() => {
                    waitFor('discord', 'DiscordSDK')
                        .then(() => {
                            this._platformSdk = new (window.discord as DiscordGlobal).DiscordSDK(this._appId as string)
                            return (this._platformSdk as DiscordSdkInstance).ready()
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
    authorizePlayer(options?: unknown): Promise<unknown> {
        const opts = options as { scope?: string[] } | undefined
        const scope = opts?.scope || ['identify']

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            const sdk = this._platformSdk as DiscordSdkInstance
            sdk.commands.authorize({
                client_id: this._appId,
                response_type: 'code',
                state: '',
                prompt: 'none',
                scope,
            })
                .then(({ code }) => fetch(`${APPLICATION_SERVER_PROXY_URL}/discord/auth-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code,
                        appId: this._appId,
                    }),
                }))
                .then((response) => response.json())
                .then((data) => {
                    this._accessToken = data.accessToken

                    this._playerExtra = {
                        token: data.token,
                        accessToken: this._accessToken,
                        channelId: sdk.channelId,
                    }

                    return sdk.commands.authenticate({
                        access_token: this._accessToken as string,
                    })
                })
                .then((auth) => {
                    if (auth === null) {
                        this._playerApplyGuestData()
                        throw new Error('Authorization failed')
                    }

                    return fetch(`${DISCORD_BASE_URL}/users/@me`, {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${this._accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    })
                })
                .then((response) => (response as Response).json())
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

                    this._isPlayerAuthorized = true
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
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
    paymentsPurchase(id: string): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE);
            (this._platformSdk as DiscordSdkInstance).commands.startPurchase({ sku_id: product.platformProductId as string })
                .then((purchase) => {
                    if (!purchase) {
                        throw new Error('Purchase failed')
                    }

                    const mergedPurchase: AnyRecord & { id: string } = { id, ...(purchase as AnyRecord) }
                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            const purchaseToken = this._paymentsPurchases[purchaseIndex].purchaseToken as string
            fetch(`${DISCORD_BASE_URL}/applications/${this._appId}/entitlements/${purchaseToken}/consume`, {
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

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG);
            (this._platformSdk as DiscordSdkInstance).commands.getSkus()
                .then(({ skus: discordProducts }) => {
                    const mergedProducts = products.map((product) => {
                        const discordProduct = discordProducts.find((p) => p.id === product.platformProductId) as DiscordSku

                        const formattedPrice = (window.discord as DiscordGlobal).PriceUtils.formatPrice(discordProduct.price)
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

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES);
            (this._platformSdk as DiscordSdkInstance).commands.getEntitlements()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.entitlements.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.id) as AnyRecord
                        const merged: AnyRecord = { id: product.id }
                        Object.assign(merged, purchase)
                        return merged as AnyRecord & { id: string }
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
    inviteFriends(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS);
            (this._platformSdk as DiscordSdkInstance).commands.openInviteDialog()
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, error)
                })
        }

        return promiseDecorator.promise
    }

    share(options?: unknown): Promise<unknown> {
        const opts = (options ?? {}) as { mediaUrl?: string }
        if (!opts.mediaUrl) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE);
            (this._platformSdk as DiscordSdkInstance).commands.openShareMomentDialog({
                mediaUrl: opts.mediaUrl,
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
