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
    STORAGE_TYPE,
    CLOUD_STORAGE_MODE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    LEADERBOARD_TYPE,
    type PlatformId,
    type CloudStorageMode,
    type LeaderboardType,
} from '../constants'
import type { AnyRecord } from '../types/common'

const PROD_SDK_URL = 'https://app.bitquest.games/bqsdk.min.js'
const STAGE_SDK_URL = 'https://app-stage.bitquest.games/bqsdk.min.js'
const BANK_SDK_URL = 'https://app-global.memebeat.io/bqsdk.min.js'

interface BqStorage {
    get(key: string, type: string): Promise<unknown>
    set(key: string, value: unknown, type: string): Promise<unknown>
    delete(key: string, type: string): Promise<unknown>
}

interface BqAdvertisement {
    showRewarded(): void
    showInterstitial(): void
    showPreRoll(): void
    showBanner(): void
    hideBanner(): void
    on(event: string, callback: (state: string) => void): void
}

interface BqPayment {
    purchase(id: string): Promise<{ purchaseData: AnyRecord }>
    getCatalog(): Promise<AnyRecord[]>
    consumePurchase(id: string): Promise<unknown>
    getPurchases(): Promise<{ purchases: AnyRecord[] }>
}

interface BqLeaderboard {
    setScore(id: string, score: number): Promise<unknown>
    getEntries(id: string): Promise<unknown>
}

interface BqPlatform {
    sendMessage(message: string): void
    getServerTime(): number
}

interface BqSdk {
    initialize(): Promise<unknown>
    player: { id?: string | null; name?: string } & AnyRecord
    storage: BqStorage
    advertisement: BqAdvertisement
    payment: BqPayment
    leaderboard: BqLeaderboard
    platform: BqPlatform
}

declare global {
    interface Window {
        bq?: BqSdk
    }
}

class BitquestPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.BITQUEST
    }

    get isPaymentsSupported(): boolean {
        return true
    }

    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    get isBannerSupported(): boolean {
        return true
    }

    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // storage
    get cloudStorageMode(): CloudStorageMode {
        return CLOUD_STORAGE_MODE.LAZY
    }

    get cloudStorageReady(): Promise<void> {
        return Promise.resolve()
    }

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const urlParams = new URLSearchParams(window.location.search)
            const target = urlParams.get('target')
            let sdkUrl: string

            switch (target) {
                case 'prod':
                    sdkUrl = PROD_SDK_URL
                    break
                case 'stage':
                    sdkUrl = STAGE_SDK_URL
                    break
                case 'bank':
                    sdkUrl = BANK_SDK_URL
                    break
                default:
                    sdkUrl = PROD_SDK_URL
            }

            addJavaScript(sdkUrl).then(() => {
                waitFor('bq').then(() => {
                    this._platformSdk = window.bq as BqSdk

                    const sdk = this._platformSdk as BqSdk
                    sdk.initialize()
                        .then(() => {
                            sdk.platform.sendMessage('game_ready')

                            const { player } = sdk
                            const { id = null, name = '' } = player
                            this._playerId = id ?? null
                            this._playerName = name
                            this._isPlayerAuthorized = true
                            this._setDefaultStorageType(STORAGE_TYPE.PLATFORM_INTERNAL)
                            this._playerExtra = player

                            this.#setupAdvertisementHandlers()
                            this.showPreRoll()

                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                        .catch((e) => {
                            this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e)
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    // storage
    loadCloudKey(key: string): Promise<unknown> {
        return (this._platformSdk as BqSdk).storage.get(key, 'platform_internal').then((value) => (
            value === undefined ? null : value
        ))
    }

    saveCloudKey(key: string, value: unknown): Promise<void> {
        return (this._platformSdk as BqSdk).storage.set(key, value, 'platform_internal').then(() => undefined)
    }

    deleteCloudKey(key: string): Promise<void> {
        return (this._platformSdk as BqSdk).storage.delete(key, 'platform_internal').then(() => undefined)
    }

    // advertisement
    showRewarded(): void {
        (this._platformSdk as BqSdk).advertisement.showRewarded()
    }

    showInterstitial(): void {
        (this._platformSdk as BqSdk).advertisement.showInterstitial()
    }

    showPreRoll(): void {
        (this._platformSdk as BqSdk).advertisement.showPreRoll()
    }

    showBanner(): void {
        (this._platformSdk as BqSdk).advertisement.showBanner()
    }

    hideBanner(): void {
        (this._platformSdk as BqSdk).advertisement.hideBanner()
    }

    // payments
    paymentsPurchase(id: string): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE);
            (this._platformSdk as BqSdk).payment.purchase(id)
                .then((purchase) => {
                    const mergedPurchase: AnyRecord = {
                        id,
                        ...purchase.purchaseData,
                    }

                    delete mergedPurchase.productID

                    this._paymentsPurchases.push(mergedPurchase as AnyRecord & { id: string })
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()

        if (!products || !Array.isArray(products) || products.length === 0) {
            return Promise.reject(new Error('No platform products available'))
        }

        if (!this._isInitialized || !(this._platformSdk as BqSdk | null)?.payment) {
            return Promise.reject(new Error('SDK not initialized or payment not available'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG);
            (this._platformSdk as BqSdk).payment.getCatalog()
                .then((catalog) => {
                    if (!Array.isArray(catalog)) {
                        throw new Error('Catalog response is not an array')
                    }

                    const mergedProducts = products
                        .map((product) => {
                            const catalogProduct = catalog.find((p) => p.purchaseId === product.id)

                            if (!catalogProduct) {
                                return null
                            }

                            return {
                                id: product.id,
                                name: catalogProduct.name,
                                description: catalogProduct.description,
                                price: catalogProduct.priceValue,
                                priceCurrencyCode: catalogProduct.currencyCode,
                                priceValue: catalogProduct.price,
                            }
                        })
                        .filter(Boolean)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, mergedProducts)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, error)
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
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE);
            (this._platformSdk as BqSdk).payment.consumePurchase(id)
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

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES);
            (this._platformSdk as BqSdk).payment.getPurchases()
                .then((response) => {
                    const purchases = response?.purchases ?? []
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.purchaseId)
                        if (!product) {
                            return null
                        }

                        const mergedPurchase: AnyRecord = {
                            id: product.id,
                            ...purchase,
                        }

                        delete mergedPurchase.purchaseId
                        return mergedPurchase as AnyRecord & { id: string }
                    }).filter((p): p is AnyRecord & { id: string } => p !== null)

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    // leaderboards
    leaderboardsSetScore(id?: unknown, score?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const numericScore = typeof score === 'number' ? score : parseInt(score as string, 10);
            (this._platformSdk as BqSdk).leaderboard.setScore(id as string, numericScore)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id?: unknown): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES);
            (this._platformSdk as BqSdk).leaderboard.getEntries(id as string)
                .then((entries) => {
                    const entriesArray = Array.isArray(entries)
                        ? entries
                        : (entries as AnyRecord)?.entries || (entries as AnyRecord)?.data || []
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entriesArray)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, error)
                })
        }

        return promiseDecorator.promise
    }

    // platform
    getServerTime(): Promise<number> {
        return new Promise((resolve) => {
            const ts = (this._platformSdk as BqSdk).platform.getServerTime()
            resolve(ts)
        })
    }

    #setupAdvertisementHandlers(): void {
        const rewardedMap: Record<string, string> = {
            loading: REWARDED_STATE.LOADING,
            opened: REWARDED_STATE.OPENED,
            closed: REWARDED_STATE.CLOSED,
            failed: REWARDED_STATE.FAILED,
            rewarded: REWARDED_STATE.REWARDED,
        }

        const interstitialMap: Record<string, string> = {
            loading: INTERSTITIAL_STATE.LOADING,
            opened: INTERSTITIAL_STATE.OPENED,
            closed: INTERSTITIAL_STATE.CLOSED,
            failed: INTERSTITIAL_STATE.FAILED,
        }

        const bannerMap: Record<string, string> = {
            loading: BANNER_STATE.LOADING,
            shown: BANNER_STATE.SHOWN,
            hidden: BANNER_STATE.HIDDEN,
            failed: BANNER_STATE.FAILED,
        }

        const sdk = this._platformSdk as BqSdk

        sdk.advertisement.on('REWARDED_STATE_CHANGED', (state) => {
            const mappedState = rewardedMap[state]
            if (!mappedState) {
                return
            }

            if (mappedState === REWARDED_STATE.FAILED) {
                this._showAdFailurePopup(true)
            } else {
                this._setRewardedState(mappedState)

                if (mappedState === REWARDED_STATE.REWARDED) {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                }
            }
        })

        sdk.advertisement.on('INTERSTITIAL_STATE_CHANGED', (state) => {
            const mappedState = interstitialMap[state]
            if (mappedState) {
                if (mappedState === INTERSTITIAL_STATE.FAILED) {
                    this._showAdFailurePopup(false)
                } else {
                    this._setInterstitialState(mappedState)
                }
            }
        })

        sdk.advertisement.on('BANNER_STATE_CHANGED', (state) => {
            const mappedState = bannerMap[state]
            if (mappedState) {
                this._setBannerState(mappedState)
            }
        })
    }
}

export default BitquestPlatformBridge
