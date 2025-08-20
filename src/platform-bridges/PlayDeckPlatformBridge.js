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
    PLATFORM_ID,
    PLATFORM_MESSAGE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
} from '../constants'

class PlayDeckPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.PLAYDECK
    }

    get platformLanguage() {
        if (this.#language) {
            return this.#language
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
        return true
    }

    // social
    get isShareSupported() {
        return true
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    #language

    #urlParams

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    _isPlayerAuthorized = true

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const getUserProfileHandler = ({ data }) => {
                if (!data || !data.playdeck) {
                    return
                }

                const pdData = data.playdeck

                if (pdData.method === 'getUserProfile') {
                    const profile = pdData.value

                    this._playerId = profile.telegramId
                    this._playerPhotos = [profile.avatar]
                    this._playerName = profile.username
                    this.#language = profile.locale
                    this.#urlParams = profile.params

                    window.removeEventListener('message', getUserProfileHandler)

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                }
            }

            window.addEventListener('message', getUserProfileHandler)

            window.parent.postMessage({ playdeck: { method: 'getUserProfile' } }, '*')
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_OVER: {
                window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*')
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAME_READY: {
                window.parent.postMessage({ playdeck: { method: 'loading', value: 100 } }, '*')
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // advertisement
    showInterstitial() {
        const showAdHandler = ({ data }) => {
            const playdeck = data?.playdeck
            if (!playdeck) {
                return
            }

            // ¯\_(ツ)_/¯ https://github.com/ton-play/playdeck-integration-guide/wiki/7.-Advertising-Monetization
            // Ad events can be changed anytime but we are guarantee that rewardedAd and errAd events will always exists.
            switch (playdeck.method) {
                case 'startAd':
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                    break
                case 'rewardedAd':
                case 'skipAd':
                    this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    window.removeEventListener('message', showAdHandler)
                    break
                case 'errAd':
                case 'notFoundAd':
                    this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                    window.removeEventListener('message', showAdHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showAdHandler)
        window.parent.postMessage({ playdeck: { method: 'showAd' } }, '*')
    }

    showRewarded() {
        const showAdHandler = ({ data }) => {
            const playdeck = data?.playdeck
            if (!playdeck) {
                return
            }

            // ¯\_(ツ)_/¯ https://github.com/ton-play/playdeck-integration-guide/wiki/7.-Advertising-Monetization
            // Ad events can be changed anytime but we are guarantee that rewardedAd and errAd events will always exists.
            switch (playdeck.method) {
                case 'startAd':
                    this._setRewardedState(REWARDED_STATE.OPENED)
                    break
                case 'rewardedAd':
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    window.removeEventListener('message', showAdHandler)
                    break
                case 'skipAd':
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    window.removeEventListener('message', showAdHandler)
                    break
                case 'errAd':
                case 'notFoundAd':
                    this._setRewardedState(REWARDED_STATE.FAILED)
                    window.removeEventListener('message', showAdHandler)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showAdHandler)
        window.parent.postMessage({ playdeck: { method: 'showAd' } }, '*')
    }

    // player
    authorizePlayer() {
        return Promise.resolve()
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
                const result = {}
                const keys = Array.isArray(key) ? key : [key]

                const getDataHandler = ({ data }) => {
                    if (!data || !data.playdeck || data.playdeck.method !== 'getData' || !keys.includes(data.playdeck.key)) {
                        return
                    }

                    const pdData = data.playdeck

                    if (pdData.method === 'getData') {
                        result[pdData.key] = pdData.value.data
                    }

                    if (Object.keys(result).length === keys.length) {
                        window.removeEventListener('message', getDataHandler)
                        const values = Array.isArray(key) ? key.map((k) => result[k]) : result[key]
                        resolve(values)
                    }
                }

                window.addEventListener('message', getDataHandler)

                keys.forEach((k) => window.parent.postMessage({ playdeck: { method: 'getData', key: k } }, '*'))
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const keys = Array.isArray(key) ? key : [key]
                const values = Array.isArray(value) ? value : [value]
                const valuesString = values.map((v) => {
                    if (typeof v !== 'string') {
                        return JSON.stringify(v)
                    }
                    return v
                })

                keys.forEach((k, i) => window.parent.postMessage({ playdeck: { method: 'setData', key: k, value: valuesString[i] } }, '*'))

                resolve()
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const keys = Array.isArray(key) ? key : [key]

                keys.forEach((k) => window.parent.postMessage({ playdeck: { method: 'setData', key: k, value: '' } }, '*'))

                resolve()
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // social
    share() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            const shareHandler = ({ data }) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'customShare') {
                    window.removeEventListener('message', shareHandler)
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                }
            }

            window.addEventListener('message', shareHandler)

            window.parent.postMessage({ playdeck: { method: 'customShare', value: this.#urlParams } }, '*')
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id, options) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        if (options && options.externalId) {
            product.externalId = options.externalId
        }

        if (!product.externalId) {
            product.externalId = this._paymentsGenerateTransactionId(id)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const requestPaymentHandler = ({ data }) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'requestPayment') {
                    window.parent.postMessage(
                        {
                            playdeck: {
                                method: 'openTelegramLink',
                                value: playdeck.value.url,
                            },
                        },
                        '*',
                    )

                    window.removeEventListener('message', requestPaymentHandler)
                }
            }

            const invoiceClosedHandler = ({ data }) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'invoiceClosed') {
                    if (playdeck.value.status === 'paid') {
                        window.removeEventListener('message', invoiceClosedHandler)
                        const mergedPurchase = { id, ...playdeck.value }
                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else if (playdeck.value.status === 'cancelled' || playdeck.value.status === 'failed') {
                        window.removeEventListener('message', invoiceClosedHandler)
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, playdeck.value)
                    }
                }
            }

            window.addEventListener('message', requestPaymentHandler)

            window.addEventListener('message', invoiceClosedHandler)

            window.parent.postMessage({
                playdeck: {
                    method: 'requestPayment',
                    value: product,
                },
            }, '*')
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        const updatedProducts = products.map((product) => ({
            id: product.id,
            price: `${product.amount} Stars`,
            priceCurrencyCode: 'Stars',
            priceValue: product.amount,
        }))

        return Promise.resolve(updatedProducts)
    }
}

export default PlayDeckPlatformBridge
