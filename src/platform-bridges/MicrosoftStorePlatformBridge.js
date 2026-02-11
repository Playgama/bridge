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
import {
    ACTION_NAME,
    ERROR,
    INTERSTITIAL_STATE,
    PLATFORM_ID,
    REWARDED_STATE,
    STORAGE_TYPE,
} from '../constants'
import {
    addJavaScript,
    deformatPrice,
    postToWebView,
    waitFor,
} from '../common/utils'

const PLAYGAMA_ADS_SDK_URL = 'https://playgama.com/ads/msn.v0.1.js'
const PLAYGAMA_ADS_PROMISE = 'playgama_ads_promise'
class MicrosoftStorePlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.MICROSOFT_STORE
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
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    // social
    get isRateSupported() {
        return true
    }

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    #playgamaAds = null

    #playgamaAdsPromise = this._createPromiseDecorator(PLAYGAMA_ADS_PROMISE).promise

    #interstitialShownCount = 0

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options || !this._options.gameId || !this._options.playgamaAdsId) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
                return promiseDecorator.promise
            }

            try {
                this.#setupHandlers()
                this.#postMessage(ACTION_NAME.INITIALIZE)
            } catch (error) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    error,
                )
            }

            const { playgamaAdsId } = this._options
            addJavaScript(PLAYGAMA_ADS_SDK_URL)
                .then(() => waitFor('pgAds'))
                .then(() => window.pgAds.init(playgamaAdsId))
                .then(() => {
                    this.#playgamaAds = window.pgAds
                    const { gameId } = this._options
                    this.#playgamaAds.updateTargeting({ gameId })

                    this._resolvePromiseDecorator(PLAYGAMA_ADS_PROMISE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(
                        PLAYGAMA_ADS_PROMISE,
                        error,
                    )
                })
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                return promiseDecorator.promise
            }

            this.#postMessage(ACTION_NAME.AUTHORIZE_PLAYER)
        }

        return promiseDecorator.promise
    }

    showInterstitial() {
        this.#interstitialShownCount += 1

        if (this.#interstitialShownCount === 3) {
            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            return this.rate()
        }

        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(false)
        }

        return new Promise((resolve) => {
            this.#playgamaAds.requestOutOfPageAd('interstitial')
                .then((adInstance) => {
                    switch (adInstance.state) {
                        case 'empty':
                            this._advertisementShowErrorPopup(false).then(() => resolve())
                            return
                        case 'ready':
                            this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                            adInstance.show()
                            break
                        default:
                            break
                    }

                    adInstance.addEventListener('ready', () => {
                        this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                        adInstance.show()
                    })

                    adInstance.addEventListener('empty', () => {
                        this._advertisementShowErrorPopup(false).then(() => resolve())
                    })

                    adInstance.addEventListener('closed', () => {
                        this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                        resolve()
                    })
                })
        })
    }

    showRewarded() {
        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(true)
        }

        return new Promise((resolve) => {
            this.#playgamaAds.requestOutOfPageAd('rewarded')
                .then((adInstance) => {
                    switch (adInstance.state) {
                        case 'empty':
                            this._advertisementShowErrorPopup(true).then(() => resolve())
                            return
                        case 'ready':
                            this._setRewardedState(REWARDED_STATE.OPENED)
                            adInstance.show()
                            break
                        default:
                            break
                    }

                    adInstance.addEventListener('ready', () => {
                        this._setRewardedState(REWARDED_STATE.OPENED)
                        adInstance.show()
                    })

                    adInstance.addEventListener('rewarded', () => {
                        this._setRewardedState(REWARDED_STATE.REWARDED)
                    })

                    adInstance.addEventListener('empty', () => {
                        this._advertisementShowErrorPopup(true).then(() => resolve())
                    })

                    adInstance.addEventListener('closed', () => {
                        this._setRewardedState(REWARDED_STATE.CLOSED)
                        resolve()
                    })
                })
        })
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

    setDataToStorage(key, value, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.setDataToStorage(key, value, type)
        }

        const keyWithPrefix = this.#withStorageKeyPrefix(key)

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.SET_STORAGE_DATA, { key: keyWithPrefix, value })
        }

        return promiseDecorator.promise
    }

    getDataFromStorage(key, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.getDataFromStorage(key, type)
        }

        const keyWithPrefix = this.#withStorageKeyPrefix(key)

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.GET_STORAGE_DATA, keyWithPrefix)
        }

        return promiseDecorator.promise
    }

    deleteDataFromStorage(key, type) {
        if (type !== STORAGE_TYPE.PLATFORM_INTERNAL) {
            return super.deleteDataFromStorage(key, type)
        }

        const keyWithPrefix = this.#withStorageKeyPrefix(key)

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA)

            this.#postMessage(ACTION_NAME.DELETE_STORAGE_DATA, keyWithPrefix)
        }

        return promiseDecorator.promise
    }

    paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)
            this.#postMessage(ACTION_NAME.PURCHASE, product.platformProductId)
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        const product = this._paymentsGetProductPlatformData(id)

        if (purchaseIndex < 0 || !product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
            this.#postMessage(ACTION_NAME.CONSUME_PURCHASE, product.platformProductId)
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
            this.#postMessage(ACTION_NAME.GET_CATALOG, products.map(({ platformProductId }) => platformProductId))
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)
            this.#postMessage(ACTION_NAME.GET_PURCHASES)
        }

        return promiseDecorator.promise
    }

    rate() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE)
            this.#postMessage(ACTION_NAME.RATE)
            this._pauseStateAggregator.setState('rate', true)
        }

        return promiseDecorator.promise
    }

    #getStorageKeyPrefix() {
        const gameId = this._options?.gameId
        return gameId ? `pg_${gameId}_` : null
    }

    #withStorageKeyPrefix(key) {
        const prefix = this.#getStorageKeyPrefix()
        if (!prefix) {
            return key
        }

        if (Array.isArray(key)) {
            return key.map((k) => `${prefix}${k}`)
        }

        return `${prefix}${key}`
    }

    #postMessage(action, data) {
        postToWebView(JSON.stringify({ action, data }))
    }

    #setupHandlers() {
        window.chrome.webview.addEventListener('message', (event) => {
            try {
                let { data } = event

                if (typeof event.data === 'string') {
                    data = JSON.parse(event.data)
                }

                const { action } = data || {}

                if (action === ACTION_NAME.INITIALIZE) {
                    this.#initialize(data)
                } else if (action === ACTION_NAME.AUTHORIZE_PLAYER) {
                    this.#authorizePlayer(data)
                } else if (action === ACTION_NAME.GET_CATALOG) {
                    this.#getCatalog(data)
                } else if (action === ACTION_NAME.PURCHASE) {
                    this.#purchase(data)
                } else if (action === ACTION_NAME.CONSUME_PURCHASE) {
                    this.#consumePurchase(data)
                } else if (action === ACTION_NAME.GET_PURCHASES) {
                    this.#getPurchases(data)
                } else if (action === ACTION_NAME.RATE) {
                    this.#rate(data)
                } else if (action === ACTION_NAME.GET_STORAGE_DATA) {
                    this.#getStorageData(data)
                } else if (action === ACTION_NAME.SET_STORAGE_DATA) {
                    this.#setStorageData(data)
                } else if (action === ACTION_NAME.DELETE_STORAGE_DATA) {
                    this.#deleteStorageData(data)
                }
            } catch (error) {
                console.error('Error parsing Microsoft Store message:', error)
            }
        })
    }

    #initialize(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.INITIALIZE,
                new Error(data),
            )
            return
        }

        this.#playgamaAdsPromise.then(() => {
            this.showInterstitial()
        }).finally(() => {
            this._isInitialized = true
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE, data)
        })
    }

    #authorizePlayer(data) {
        if (!data?.success) {
            this._playerApplyGuestData()
            this._rejectPromiseDecorator(
                ACTION_NAME.AUTHORIZE_PLAYER,
                new Error(data),
            )
            return
        }

        this._playerExtra = data.data

        this._isPlayerAuthorized = true
        this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
    }

    #getCatalog(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_CATALOG,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()
        const mergedProducts = products.map((product) => {
            const msProduct = data.data?.find((p) => p.id === product.platformProductId)

            const priceValue = deformatPrice(msProduct?.price?.formattedPrice)
            const priceCurrencyCode = msProduct?.price?.currencyCode || null
            const price = `${priceValue} ${priceCurrencyCode}`

            return {
                id: product.id,
                title: msProduct?.title,
                description: msProduct?.description,
                price,
                priceValue,
                priceCurrencyCode,
            }
        })

        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
    }

    #purchase(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.PURCHASE,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()
        const product = products.find(
            (p) => p.platformProductId === data.data?.id,
        )

        const mergedPurchase = {
            id: product?.id,
            platformProductId: data.data?.id,
            status: data.data?.status,
        }

        this._paymentsPurchases.push(mergedPurchase)
        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
    }

    #consumePurchase(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.CONSUME_PURCHASE,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()

        const product = products.find(
            (p) => p.platformProductId === data.data?.id,
        )

        const mergedPurchase = {
            ...data.data,
            id: product?.id,
            platformProductId: data.data?.id,
        }

        const purchaseIndex = this._paymentsPurchases.findIndex(
            (p) => p.id === product?.id,
        )

        if (purchaseIndex >= 0) {
            this._paymentsPurchases.splice(purchaseIndex, 1)
        }

        this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, mergedPurchase)
    }

    #getPurchases(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_PURCHASES,
                new Error(data),
            )
            return
        }

        const products = this._paymentsGetProductsPlatformData()

        this._paymentsPurchases = (data.data || [])
            .map((purchase) => {
                const product = products.find(
                    (p) => p.platformProductId === purchase.id,
                )

                return {
                    ...purchase,
                    id: product?.id,
                    platformProductId: purchase.id,
                }
            })

        this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
    }

    #rate(data) {
        this._pauseStateAggregator.setState('rate', false)

        if (!data || data.success === false) {
            this._rejectPromiseDecorator(
                ACTION_NAME.RATE,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.RATE)
    }

    // storage
    #getStorageData(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.GET_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.GET_STORAGE_DATA, data.data)
    }

    #setStorageData(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.SET_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.SET_STORAGE_DATA, data.data)
    }

    #deleteStorageData(data) {
        if (!data?.success) {
            this._rejectPromiseDecorator(
                ACTION_NAME.DELETE_STORAGE_DATA,
                new Error(data),
            )
            return
        }

        this._resolvePromiseDecorator(ACTION_NAME.DELETE_STORAGE_DATA, data.data)
    }
}

export default MicrosoftStorePlatformBridge
