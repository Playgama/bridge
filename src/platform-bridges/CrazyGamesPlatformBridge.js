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
import { addJavaScript, createAdvertisementBannerContainer, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
    BANNER_CONTAINER_ID,
} from '../constants'

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
const XSOLLA_PAYSTATION_EMBED_URL = 'https://cdn.xsolla.net/payments-bucket-prod/embed/1.5.0/widget.min.js'
const XSOLLA_SDK_URL = 'https://store.xsolla.com/api/v2/project/'

class CrazyGamesPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.CRAZY_GAMES
    }

    get platformLanguage() {
        if (this.#isUserAccountAvailable) {
            return this._platformSdk.user.systemInfo.countryCode.toLowerCase()
        }

        return super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // player
    get isPlayerAuthorizationSupported() {
        return this.#isUserAccountAvailable
    }

    get isPaymentsSupported() {
        return this.#isUserAccountAvailable === true
    }

    // device
    get deviceType() {
        if (this.#isUserAccountAvailable) {
            const userDeviceType = this._platformSdk.user.systemInfo.device.type.toLowerCase()
            if ([
                DEVICE_TYPE.DESKTOP,
                DEVICE_TYPE.MOBILE,
                DEVICE_TYPE.TABLET,
            ].includes(userDeviceType)
            ) {
                return userDeviceType
            }
        }

        return super.deviceType
    }

    #currentAdvertisementIsRewarded = false

    #isUserAccountAvailable = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL).then(() => {
                waitFor('CrazyGames', 'SDK', 'init').then(() => {
                    this._platformSdk = window.CrazyGames.SDK

                    this._defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL
                    this._isBannerSupported = true
                    this._platformSdk.init().then(() => {
                        this.#isUserAccountAvailable = this._platformSdk.user.isUserAccountAvailable
                        const getPlayerInfoPromise = this.#getPlayer()

                        if (this.options.xsollaProjectId) {
                            this.#ensurePaystationLoaded()
                        }

                        Promise
                            .all([getPlayerInfoPromise])
                            .finally(() => {
                                this._isInitialized = true
                                this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                            })
                    })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        if (!this.#isUserAccountAvailable) {
            return Promise.reject()
        }

        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
            this._platformSdk.user.showAuthPrompt()
                .then(() => {
                    this.#getPlayer()
                        .then(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                        })
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                })
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED: {
                this._platformSdk.game.loadingStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED: {
                this._platformSdk.game.loadingStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED: {
                this._platformSdk.game.gameplayStart()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED: {
                this._platformSdk.game.gameplayStop()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT: {
                this._platformSdk.game.happytime()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageSupported(storageType)
    }

    isStorageAvailable(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return true
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                if (Array.isArray(key)) {
                    const values = []
                    key.forEach((k) => {
                        let value = this._platformSdk.data.getItem(k)

                        if (tryParseJson) {
                            try {
                                value = JSON.parse(value)
                            } catch (e) {
                                // keep value string or null
                            }
                        }
                        values.push(value)
                    })

                    resolve(values)
                    return
                }

                let value = this._platformSdk.data.getItem(key)

                if (tryParseJson) {
                    try {
                        value = JSON.parse(value)
                    } catch (e) {
                        // keep value string or null
                    }
                }
                resolve(value)
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        let valueData = value[i]

                        if (typeof value[i] !== 'string') {
                            valueData = JSON.stringify(value[i])
                        }

                        this._platformSdk.data.setItem(key[i], valueData)
                    }

                    resolve()
                    return
                }

                let valueData = value

                if (typeof value !== 'string') {
                    valueData = JSON.stringify(value)
                }

                this._platformSdk.data.setItem(key, valueData)
                resolve()
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (Array.isArray(key)) {
                key.forEach((k) => this._platformSdk.data.removeItem(k))
                return Promise.resolve()
            }

            this._platformSdk.data.removeItem(key)
            return Promise.resolve()
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showBanner(position) {
        let container = document.getElementById(BANNER_CONTAINER_ID)
        if (!container) {
            container = createAdvertisementBannerContainer(position)
        }

        container.style.display = 'block'

        this._platformSdk.banner.requestResponsiveBanner([BANNER_CONTAINER_ID])
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
                container.style.display = 'none'
            })
    }

    hideBanner() {
        const container = document.getElementById(BANNER_CONTAINER_ID)
        if (container) {
            container.style.display = 'none'
        }

        this._platformSdk.banner.clearAllBanners()
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showInterstitial() {
        this.#currentAdvertisementIsRewarded = false
        this._platformSdk.ad.requestAd('midgame', this.#adCallbacks)
    }

    showRewarded() {
        this.#currentAdvertisementIsRewarded = true
        this._platformSdk.ad.requestAd('rewarded', this.#adCallbacks)
    }

    checkAdBlock() {
        return new Promise((resolve) => {
            this._platformSdk.ad.hasAdblock().then((res) => {
                resolve(res)
            })
        })
    }

    paymentsPurchase(id) {
        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        const sku = product.platformProductId || product.id

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#ensurePaystationLoaded()
                .then(() => this.#getXsollaToken())
                .then((token) => {
                    const paystation = window.XPayStationWidget
                    if (!paystation) {
                        throw new Error('Xsolla Pay Station widget not loaded')
                    }

                    paystation.init({
                        access_token: token,
                        sandbox: this.options.isSandbox || false,
                        childWindow: { target: '_blank' },
                        settings: { external_id: sku },
                    })

                    let resolved = false

                    paystation.on(paystation.eventTypes.STATUS, (_evt, data) => {
                        try {
                            const info = (data && data.paymentInfo) || {}
                            if (info.status && /done|charged|success/i.test(String(info.status))) {
                                const orderId = info.order_id || info.invoice
                                if (!orderId) {
                                    return
                                }

                                this.#getOrder(this.options.xsollaProjectId, orderId, token)
                                    .then((order) => {
                                        this._platformSdk.analytics.trackOrder('xsolla', order)

                                        const mergedPurchase = {
                                            id: product.id,
                                            sku,
                                            orderId,
                                            ...order,
                                        }

                                        this._paymentsPurchases.push(mergedPurchase)

                                        if (!resolved) {
                                            resolved = true
                                            this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                                        }
                                    })
                                    .catch((err) => {
                                        if (!resolved) {
                                            this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, err)
                                        }
                                    })
                            }
                        } catch (err) {
                            if (!resolved) {
                                this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, err)
                            }
                        }
                    })

                    paystation.on('close', () => {
                        if (!resolved) {
                            this._rejectPromiseDecorator(
                                ACTION_NAME.PURCHASE,
                                new Error('Purchase canceled/closed'),
                            )
                        }
                    })

                    paystation.open()
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject(new Error('No platform products available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#getXsollaToken()
                .then((token) => fetch(
                    `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/items?limit=50`,
                    { headers: { Authorization: `Bearer ${token}` } },
                ))
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Xsolla catalog HTTP ${res.status}`)
                    }
                    return res.json()
                })
                .then((data) => {
                    const bySku = new Map((data.items || []).map((it) => [it.sku, it]))

                    const mergedProducts = products.map((product) => {
                        const sku = product.platformProductId || product.id
                        const x = bySku.get(sku)

                        return {
                            id: product.id,
                            name: x?.name ?? product.name ?? product.id,
                            description: x?.description ?? product.description ?? '',
                            price: x?.price?.amount ?? null,
                            priceCurrencyCode: x?.price?.currency ?? null,
                            priceValue: x?.price?.amount ?? null,
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

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject(new Error('No such purchase to consume'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
            try {
                this._paymentsPurchases.splice(purchaseIndex, 1)
                this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id })
            } catch (error) {
                this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
            }
        }
        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#getXsollaToken()
                .then((token) => fetch(
                    `${XSOLLA_SDK_URL}/${this.options.xsollaProjectId}/user/inventory/items`,
                    { headers: { Authorization: `Bearer ${token}` } },
                ))
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Xsolla inventory HTTP ${res.status}`)
                    }
                    return res.json()
                })
                .then((data) => {
                    const products = this._paymentsGetProductsPlatformData() || []

                    this._paymentsPurchases = (data.items || [])
                        .map((item) => {
                            const product = products.find((p) => p.id === item.sku)
                            if (!product) {
                                return null
                            }

                            const mergedPurchase = {
                                id: product.id,
                                ...item,
                            }

                            return mergedPurchase
                        })
                        .filter(Boolean)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    #adCallbacks = {
        adStarted: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        },
        adFinished: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
        },
        adError: () => {
            if (this.#currentAdvertisementIsRewarded) {
                this._setRewardedState(REWARDED_STATE.FAILED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            }
        },
    }

    #getPlayer() {
        if (!this.#isUserAccountAvailable) {
            this._playerApplyGuestData()
            return Promise.reject()
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.user.getUser()
                .then((user) => {
                    if (!user) {
                        this._playerApplyGuestData()
                        reject()
                        return
                    }

                    this._isPlayerAuthorized = true
                    if (user.username) {
                        this._playerName = user.username
                    }

                    if (user.profilePictureUrl) {
                        this._playerPhotos = [user.profilePictureUrl]
                    }

                    this._playerExtra = user

                    if (this._options.useUserToken) {
                        this._platformSdk.user.getUserToken()
                            .then((jwt) => {
                                this._playerExtra.jwt = jwt
                            })
                            .finally(() => {
                                resolve()
                            })
                    } else {
                        resolve()
                    }
                })
                .catch((error) => {
                    this._playerApplyGuestData()
                    reject(error)
                })
        })
    }

    async #ensurePaystationLoaded() {
        if (window.XPayStationWidget) {
            return
        }
        await addJavaScript(XSOLLA_PAYSTATION_EMBED_URL)
    }

    async #getXsollaToken() {
        const token = await this._platformSdk.user.getXsollaUserToken()
        return token
    }

    async #getOrder(projectId, orderId, token) {
        const res = await fetch(
            `${XSOLLA_SDK_URL}/${projectId}/order/${orderId}`,
            { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) {
            throw new Error(`Xsolla order HTTP ${res.status}`)
        }
        return res.json()
    }
}

export default CrazyGamesPlatformBridge
