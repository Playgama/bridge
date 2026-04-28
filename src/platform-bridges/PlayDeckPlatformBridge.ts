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
    type PlatformId,
    type StorageType,
} from '../constants'
import { postToParent } from '../common/utils'
import type { AnyRecord } from '../types/common'

interface PlayDeckMessage {
    method: string
    key?: string
    value?: AnyRecord & {
        data?: unknown
        url?: string
        status?: string
        telegramId?: string
        avatar?: string
        username?: string
        locale?: string
        params?: unknown
    }
}

interface PlayDeckEventData {
    playdeck?: PlayDeckMessage
}

class PlayDeckPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.PLAYDECK
    }

    get platformLanguage(): string {
        if (this.#language) {
            return this.#language
        }

        return super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // social
    get isShareSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    protected _defaultStorageType: StorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    protected _isPlayerAuthorized = true

    #language: string | undefined

    #urlParams: unknown

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const getUserProfileHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
                if (!data || !data.playdeck) {
                    return
                }

                const pdData = data.playdeck

                if (pdData.method === 'getUserProfile') {
                    const profile = pdData.value as NonNullable<PlayDeckMessage['value']>

                    this._playerId = profile.telegramId ?? null
                    this._playerPhotos = profile.avatar ? [profile.avatar] : []
                    this._playerName = profile.username ?? null
                    this.#language = profile.locale
                    this.#urlParams = profile.params

                    window.removeEventListener('message', getUserProfileHandler as EventListener)

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                }
            }

            window.addEventListener('message', getUserProfileHandler as EventListener)

            postToParent({ playdeck: { method: 'getUserProfile' } }, '*')
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.LEVEL_FAILED: {
                postToParent({ playdeck: { method: 'gameEnd' } }, '*')
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAME_READY: {
                postToParent({ playdeck: { method: 'loading', value: 100 } }, '*')
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message, options)
            }
        }
    }

    // advertisement
    showInterstitial(): void {
        const showAdHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
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
                    window.removeEventListener('message', showAdHandler as EventListener)
                    break
                case 'errAd':
                case 'notFoundAd':
                    this._showAdFailurePopup(false)
                    window.removeEventListener('message', showAdHandler as EventListener)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showAdHandler as EventListener)
        postToParent({ playdeck: { method: 'showAd' } }, '*')
    }

    showRewarded(): void {
        const showAdHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
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
                    window.removeEventListener('message', showAdHandler as EventListener)
                    break
                case 'skipAd':
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                    window.removeEventListener('message', showAdHandler as EventListener)
                    break
                case 'errAd':
                case 'notFoundAd':
                    this._showAdFailurePopup(true)
                    window.removeEventListener('message', showAdHandler as EventListener)
                    break
                default:
                    break
            }
        }

        window.addEventListener('message', showAdHandler as EventListener)
        postToParent({ playdeck: { method: 'showAd' } }, '*')
    }

    // player
    authorizePlayer(_options?: unknown): Promise<unknown> {
        return Promise.resolve()
    }

    // storage
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const result: Record<string, unknown> = {}
                const keys = Array.isArray(key) ? key : [key]

                const getDataHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
                    if (!data || !data.playdeck || data.playdeck.method !== 'getData' || !data.playdeck.key || !keys.includes(data.playdeck.key)) {
                        return
                    }

                    const pdData = data.playdeck

                    if (pdData.method === 'getData' && pdData.key) {
                        result[pdData.key] = pdData.value?.data
                    }

                    if (Object.keys(result).length === keys.length) {
                        window.removeEventListener('message', getDataHandler as EventListener)
                        const values = Array.isArray(key) ? key.map((k) => result[k]) : result[key]
                        resolve(values)
                    }
                }

                window.addEventListener('message', getDataHandler as EventListener)

                keys.forEach((k) => postToParent({ playdeck: { method: 'getData', key: k } }, '*'))
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
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

                keys.forEach((k, i) => postToParent({ playdeck: { method: 'setData', key: k, value: valuesString[i] } }, '*'))

                resolve()
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve) => {
                const keys = Array.isArray(key) ? key : [key]

                keys.forEach((k) => postToParent({ playdeck: { method: 'setData', key: k, value: '' } }, '*'))

                resolve()
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // social
    share(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            const shareHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'customShare') {
                    window.removeEventListener('message', shareHandler as EventListener)
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                }
            }

            window.addEventListener('message', shareHandler as EventListener)

            postToParent({ playdeck: { method: 'customShare', value: this.#urlParams } }, '*')
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id: string, options?: unknown): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        const opts = options as { externalId?: string } | undefined
        if (opts && opts.externalId) {
            product.externalId = opts.externalId
        }

        if (!product.externalId) {
            product.externalId = this._paymentsGenerateTransactionId(id)
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            const requestPaymentHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'requestPayment') {
                    postToParent(
                        {
                            playdeck: {
                                method: 'openTelegramLink',
                                value: playdeck.value?.url,
                            },
                        },
                        '*',
                    )

                    window.removeEventListener('message', requestPaymentHandler as EventListener)
                }
            }

            const invoiceClosedHandler = ({ data }: MessageEvent<PlayDeckEventData>) => {
                const playdeck = data?.playdeck
                if (!playdeck) return

                if (playdeck.method === 'invoiceClosed') {
                    if (playdeck.value?.status === 'paid') {
                        window.removeEventListener('message', invoiceClosedHandler as EventListener)
                        const mergedPurchase: AnyRecord & { id: string } = { id, ...(playdeck.value as AnyRecord) }
                        this._paymentsPurchases.push(mergedPurchase)
                        this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                    } else if (playdeck.value?.status === 'cancelled' || playdeck.value?.status === 'failed') {
                        window.removeEventListener('message', invoiceClosedHandler as EventListener)
                        this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, playdeck.value)
                    }
                }
            }

            window.addEventListener('message', requestPaymentHandler as EventListener)

            window.addEventListener('message', invoiceClosedHandler as EventListener)

            postToParent({
                playdeck: {
                    method: 'requestPayment',
                    value: product,
                },
            }, '*')
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
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
