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
import { addJavaScript, getKeysFromObject, waitFor } from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_POSITION,
    LEADERBOARD_TYPE,
    STORAGE_TYPE,
    type PlatformId,
    type StorageType,
    type LeaderboardType,
} from '../constants'
import type { AdvancedBannerConfig, AnyRecord } from '../types/common'

const SDK_URL = 'https://assets.msn.com/staticsb/statics/latest/msstart-games-sdk/msstart-v1.0.0-rc.21.min.js'
const PLAYGAMA_ADS_SDK_URL = 'https://playgama.com/ads/msn.v0.1.js'

const MSN_SIZES_BY_POSITION: Record<string, [number, number][]> = {
    top: [[728, 90], [970, 250], [320, 50]],
    bottom: [[320, 50]],
    left: [[300, 250], [300, 600], [320, 50], [160, 600]],
    right: [[300, 250], [300, 600], [320, 50], [160, 600]],
    topleft: [[300, 250]],
    topright: [[300, 250]],
    bottomleft: [[300, 250]],
    bottomright: [[300, 250]],
}

interface MsnAdInstance {
    instanceId: string
    showAdsCompletedAsync: Promise<unknown>
}

interface MsnIap {
    purchaseAsync(params: { productId: string }): Promise<{
        code?: string
        description?: string
        receipt: AnyRecord
        receiptSignature: string
    }>
    consumeAsync(params: { productId: string }): Promise<{
        code?: string
        description?: string
        consumptionReceipt: AnyRecord
        consumptionSignature: string
    }>
    getAllAddOnsAsync(params: { productId: string }): Promise<AnyRecord & { code?: string; description?: string }>
    getAllPurchasesAsync(params: { productId: string }): Promise<{
        receipts: AnyRecord[]
        receiptSignature: string
    }>
}

interface MsnSdk {
    getSignedInUserAsync(): Promise<AnyRecord>
    signInAsync(): Promise<AnyRecord>
    cloudSave: {
        saveDataAsync(params: { data: AnyRecord; gameId: unknown }): Promise<unknown>
        getDataAsync(params: { gameId: unknown }): Promise<AnyRecord>
    }
    shareAsync(options: unknown): Promise<unknown>
    submitGameResultsAsync(score: unknown): Promise<unknown>
    showDisplayAdsAsync(placements: string[]): Promise<unknown>
    hideDisplayAdsAsync(): Promise<unknown>
    loadAdsAsync(rewarded: boolean): Promise<MsnAdInstance>
    showAdsAsync(instanceId: string): Promise<MsnAdInstance>
    iap: MsnIap
}

interface PgAdInstance {
    state: string
    show(): void
    addEventListener(event: string, callback: () => void): void
}

interface PgAdsSdk {
    init(id: string): Promise<unknown>
    updateTargeting(targeting: Record<string, unknown>): void
    requestOutOfPageAd(type: string): Promise<PgAdInstance>
}

declare global {
    interface Window {
        $msstart?: MsnSdk
    }
}

class MsnPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.MSN
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 60
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

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.NATIVE
    }

    // advertisement
    get isBannerSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return this.#isPaymentsSupported
    }

    protected _isAdvancedBannersSupported = true

    #playgamaAds: PgAdsSdk | null = null

    #isPaymentsSupported = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('$msstart'))
                .then(() => {
                    this._platformSdk = window.$msstart as MsnSdk;
                    (this._platformSdk as MsnSdk).getSignedInUserAsync()
                        .then((data) => {
                            this.#updatePlayerInfo(data)
                        })
                        .catch(() => {
                            this.#updatePlayerInfo(null)
                        })
                        .finally(() => {
                            this._defaultStorageType = this._isPlayerAuthorized
                                ? STORAGE_TYPE.PLATFORM_INTERNAL
                                : STORAGE_TYPE.LOCAL_STORAGE

                            this._isInitialized = true
                            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                        })
                })

            const advertisementBackfillId = (this._options?.advertisement as AnyRecord | undefined)?.backfillId as string | undefined
            if (advertisementBackfillId) {
                addJavaScript(PLAYGAMA_ADS_SDK_URL)
                    .then(() => waitFor('pgAds'))
                    .then(() => {
                        const { pgAds } = (window as unknown as { pgAds?: PgAdsSdk })
                        if (!pgAds) {
                            return
                        }
                        pgAds.init(advertisementBackfillId)
                            .then(() => {
                                this.#playgamaAds = pgAds
                                const gameId = this._options.gameId as string
                                this.#playgamaAds.updateTargeting({ gameId })
                            })
                    })
            }
        }

        return promiseDecorator.promise
    }

    // player
    authorizePlayer(): Promise<unknown> {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        return new Promise((resolve, reject) => {
            (this._platformSdk as MsnSdk).signInAsync()
                .then((response) => {
                    this.#updatePlayerInfo(response)
                    resolve(undefined)
                })
                .catch((e) => {
                    this.#updatePlayerInfo(null)
                    reject(e)
                })
        })
    }

    // storage
    getDataFromStorage(key: string | string[], storageType: StorageType, tryParseJson: boolean): Promise<unknown> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return this.#getDataFromPlatformStorage(key, tryParseJson)
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key: string | string[], value: unknown | unknown[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return new Promise((resolve, reject) => {
                const cached = this._platformStorageCachedData as AnyRecord | null
                const data: AnyRecord = cached !== null
                    ? { ...cached }
                    : {}

                if (Array.isArray(key)) {
                    const values = value as unknown[]
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = values[i]
                    }
                } else {
                    data[key] = value
                }

                (this.platformSdk as MsnSdk).cloudSave.saveDataAsync({ data, gameId: this._options.gameId })
                    .then(() => {
                        this._platformStorageCachedData = data
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key: string | string[], storageType: StorageType): Promise<void> {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }
            return new Promise((resolve, reject) => {
                const data: AnyRecord = {}
                const cached = this._platformStorageCachedData as AnyRecord | null

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = null
                        if (cached) {
                            delete cached[key[i]]
                        }
                    }
                } else {
                    data[key] = null
                    if (cached) {
                        delete cached[key]
                    }
                }

                (this.platformSdk as MsnSdk).cloudSave.saveDataAsync({ data, gameId: this._options.gameId })
                    .then(() => {
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // social
    share(options?: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as MsnSdk).shareAsync(options)
                .then(resolve)
                .catch(reject)
        })
    }

    // leaderboards
    leaderboardsSetScore(_id?: unknown, score?: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            (this._platformSdk as MsnSdk).submitGameResultsAsync(score)
                .then(resolve)
                .catch(reject)
        })
    }

    // advertisement
    showBanner(position?: unknown): void {
        let size: string

        switch (position) {
            case BANNER_POSITION.TOP:
                size = 'top:728x90'
                break
            case BANNER_POSITION.BOTTOM:
            default:
                size = 'bottom:320x50'
                break
        }

        (this._platformSdk as MsnSdk).showDisplayAdsAsync([size])
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        (this._platformSdk as MsnSdk).hideDisplayAdsAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
    }

    showAdvancedBanners(banners?: unknown): void {
        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        const bannersList = (banners as AdvancedBannerConfig[] | undefined) ?? []
        const placements = [...new Set(
            bannersList
                .map((banner) => this.#bannerToMsnPlacement(banner))
                .filter((p): p is string => Boolean(p)),
        )].slice(0, 2)

        if (placements.length === 0) {
            this._setAdvancedBannersState(BANNER_STATE.FAILED)
            return
        }

        (this._platformSdk as MsnSdk).showDisplayAdsAsync(placements)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
            })
    }

    hideAdvancedBanners(): void {
        (this._platformSdk as MsnSdk).hideDisplayAdsAsync()
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
            })
    }

    showInterstitial(): void {
        const sdk = this._platformSdk as MsnSdk
        sdk.loadAdsAsync(false)
            .then((adInstance) => sdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return adInstance.showAdsCompletedAsync
            })
            .then(() => this._setInterstitialState(INTERSTITIAL_STATE.CLOSED))
            .catch(() => this.#showPlaygamaInterstitial())
    }

    showRewarded(): void {
        const sdk = this._platformSdk as MsnSdk
        sdk.loadAdsAsync(true)
            .then((adInstance) => sdk.showAdsAsync(adInstance.instanceId))
            .then((adInstance) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return adInstance.showAdsCompletedAsync
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            })
            .catch(() => this.#showPlaygamaRewarded())
    }

    // payments
    async paymentsPurchase(id: string): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            try {
                if (!this._isPlayerAuthorized) {
                    await this.authorizePlayer()
                }

                const purchase = await (this._platformSdk as MsnSdk).iap.purchaseAsync({
                    productId: product.platformProductId as string,
                })

                if (purchase.code === 'IAP_PURCHASE_FAILURE') {
                    throw new Error(purchase.description)
                }

                const mergedPurchase = {
                    id,
                    ...purchase.receipt,
                    receiptSignature: purchase.receiptSignature,
                }

                this._paymentsPurchases.push(mergedPurchase)
                this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
            } catch (e) {
                this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, e)
            }
        }

        return promiseDecorator.promise
    }

    async paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            try {
                if (!this._isPlayerAuthorized) {
                    await this.authorizePlayer()
                }

                const response = await (this._platformSdk as MsnSdk).iap.consumeAsync({
                    productId: this._paymentsPurchases[purchaseIndex].productId as string,
                })

                if (response.code === 'IAP_CONSUME_FAILURE') {
                    throw new Error(response.description)
                }

                this._paymentsPurchases.splice(purchaseIndex, 1)
                const result: AnyRecord = {
                    id,
                    ...response.consumptionReceipt,
                    consumptionSignature: response.consumptionSignature,
                }

                delete result.productId
                this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, result)
            } catch (error) {
                this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
            }
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
            (this._platformSdk as MsnSdk).iap.getAllAddOnsAsync({ productId: this._options.gameId as string })
                .then((msnProducts) => {
                    if ((msnProducts as AnyRecord).code === 'IAP_GET_ALL_ADD_ONS_FAILURE') {
                        this._rejectPromiseDecorator(ACTION_NAME.GET_CATALOG, (msnProducts as AnyRecord).description)
                        return
                    }

                    const list = msnProducts as unknown as AnyRecord[]
                    const mergedProducts = products.map((product) => {
                        const msnProduct = list.find((p) => p.productId === product.platformProductId) as AnyRecord
                        const price = msnProduct.price as AnyRecord

                        return {
                            id: product.id,
                            title: msnProduct.title,
                            description: msnProduct.description,
                            publisherName: msnProduct.publisherName,
                            inAppOfferToken: msnProduct.inAppOfferToken,
                            isConsumable: msnProduct.isConsumable,
                            price: `${price.listPrice} ${price.currencyCode} `,
                            priceCurrencyCode: price.currencyCode,
                            priceValue: price.listPrice,
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

    async paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            try {
                if (!this._isPlayerAuthorized) {
                    await this.authorizePlayer()
                }

                const response = await (this._platformSdk as MsnSdk).iap.getAllPurchasesAsync({
                    productId: this._options.gameId as string,
                })

                const products = this._paymentsGetProductsPlatformData()
                this._paymentsPurchases = response.receipts.map((purchase) => {
                    const product = products.find((p) => p.platformProductId === purchase.productId)
                    const mergedPurchase = {
                        id: product?.id as string,
                        ...purchase,
                        receiptSignature: response.receiptSignature,
                    }

                    return mergedPurchase
                })

                this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
            } catch (error) {
                if ((error as AnyRecord)?.code === 'IAP_GET_ALL_PURCHASES_FAILURE') {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, [])
                } else {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                }
            }
        }

        return promiseDecorator.promise
    }

    #showPlaygamaInterstitial(): Promise<void> {
        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(false)
        }

        return new Promise((resolve) => {
            this.#playgamaAds!.requestOutOfPageAd('interstitial')
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

    #showPlaygamaRewarded(): Promise<void> {
        if (!this.#playgamaAds) {
            return this._advertisementShowErrorPopup(true)
        }

        return new Promise((resolve) => {
            this.#playgamaAds!.requestOutOfPageAd('rewarded')
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

    #bannerToMsnPlacement(banner: AdvancedBannerConfig): string | null {
        const position = this.#resolveMsnPosition(banner)
        if (!position) {
            return null
        }

        const sizes = MSN_SIZES_BY_POSITION[position]
        if (!sizes || sizes.length === 0) {
            return null
        }

        const width = this.#parseMsnDimension(banner.width, window.innerWidth)
        const height = this.#parseMsnDimension(banner.height, window.innerHeight)
        if (width === null || height === null) {
            return null
        }

        const smallerSizes = sizes.filter((size) => size[0] <= width && size[1] <= height)
        if (smallerSizes.length === 0) {
            return null
        }

        let bestSize = smallerSizes[0]
        let bestArea = bestSize[0] * bestSize[1]

        smallerSizes.forEach((size) => {
            const area = size[0] * size[1]
            if (area > bestArea) {
                bestArea = area
                bestSize = size
            }
        })

        return `${position}:${bestSize[0]}x${bestSize[1]}`
    }

    #parseMsnDimension(value: string | undefined, screenSize: number): number | null {
        if (typeof value !== 'string') {
            return null
        }

        if (value.endsWith('%')) {
            const percent = parseFloat(value)
            if (Number.isNaN(percent)) {
                return null
            }
            return Math.floor((screenSize * percent) / 100)
        }

        const px = parseInt(value, 10)
        if (Number.isNaN(px)) {
            return null
        }
        return px
    }

    #resolveMsnPosition(banner: AdvancedBannerConfig): string | null {
        const hasTop = banner.top !== undefined
        const hasBottom = banner.bottom !== undefined
        const hasLeft = banner.left !== undefined
        const hasRight = banner.right !== undefined

        if (hasTop && hasLeft) {
            return 'topleft'
        }
        if (hasTop && hasRight) {
            return 'topright'
        }
        if (hasBottom && hasLeft) {
            return 'bottomleft'
        }
        if (hasBottom && hasRight) {
            return 'bottomright'
        }
        if (hasTop) {
            return 'top'
        }
        if (hasBottom) {
            return 'bottom'
        }
        if (hasLeft) {
            return 'left'
        }
        if (hasRight) {
            return 'right'
        }

        return null
    }

    #updatePlayerInfo(data: AnyRecord | null): void {
        if (data) {
            this._isPlayerAuthorized = true
            this._playerId = data.playerId as string
            this._playerName = data.playerDisplayName as string
            this._playerExtra = data
            this.#isPaymentsSupported = (data.userAccountType as string).toLowerCase() === 'personal'
        } else {
            this._playerApplyGuestData()
        }
    }

    async #getDataFromPlatformStorage(key: string | string[], tryParseJson = false): Promise<unknown> {
        if (!this._platformStorageCachedData) {
            this._platformStorageCachedData = await (this.platformSdk as MsnSdk).cloudSave.getDataAsync({
                gameId: this._options.gameId,
            })
        }

        return getKeysFromObject(key, this._platformStorageCachedData as AnyRecord, tryParseJson)
    }
}

export default MsnPlatformBridge
