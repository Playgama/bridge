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
import { addJavaScript, waitFor, type AnyRecord } from '../utils'
import logger from '../lib/logger'
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, PLATFORM_MESSAGE, type PlatformId } from '../modules/platform/constants'
import { INTERSTITIAL_STATE, REWARDED_STATE } from '../modules/advertisement/constants'

const SDK_URL = 'https://gtg.samsungapps.com/gsinstant-sdk/gsinstant.0.45.js'

const GRAC_ALL_RATING_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAFZUlEQVR4nM1Ya2xTZRh+Ttud057T07Vd23W9bCOETXAoeEEw4ZI4hjFBEMgiMdGf8sMLIP5RQwyJzgWm8UIg/nAI8ZLAHyRx6m+HMLnojAkbRbuNjvW2tV2vp5djzic7Y46etqMgT3JyvtP3/b7v+d73/b7v7UsFAgHs3b1HHDh3Dvl8Hv8HNBoNOp7ehPe6uihqZ2enOHB+APcDtjy3FdTipmZR+qC0FIxrjaipq7lnBEQREMYziJ6NAnmAZVloZoTmjWYYnqjFPcdyPSEW+zmKZDI5S4i2M4r92he1Y7XryYrmimWi+GTg45J6jHt2bplQKax2rsH6pvUVEZrOxND7Wy+mhZiiHqWi5LaqnIEpUHAaXKgUuhoWFtZSUZ+yCDFqBjzNV0xIo9KgTldXfUK6GhYGxoCFoIFvqD4hA8NDV6NbGCH9XSDkNrixUDh5V/UJOSsc9FY4eAfZFFUlZOWsCybEMzzYGra6hBoU4qAgFpAvFL+Upd1ZyYYoSUhFqWDWmYvKM7kMwqlQUTmtpmHSmqpHiFEzsLDFXZbOp+GZvKY4hrvWXT1CepqHUWssKo8Lcfwd+UtxDAfvrB6hes6mKJ9MTmIqNaWo49RXkZCNq1eUS/ETSgUVdawlFlUhIZuiPJQKI5QIK+qYdCYSi+VAc6endCgRRDQTgZAXyI4a/HMIY+MTsnxxsxvNixzgaA6bmzdjtWvNLX1D+OBsV2WE7Hq7onwicQPxbAIJIQFaRyMam8aEf9aFNosZWo0WNtYGl8GNh+tXyDJfzFeZy9SUGlbWpngoRtIRpLJJJHNJReL1JRZWFiEVpUIdWzyfyeVziGZiyIt5kh1W49ZXJGRlrSQuiiFbyCKajpB2IBG8I9eXFUMNJVYlZYTblm4va0In74Rv2nd3CTEaBi8+9BLKgXSeBZOhOyRkKP+ELYaRsXFMTyeg5WjQlrnuly7td9bux2XqIj7Dp6UJWRUu1XIhHQPSU2+zoNE1N2uQ0mLpr5UwlCkvqO1lBmK5KGc8RQs5KkzQJTS6HOC4+RminmNxPTaGH671zZNd8V6ZTygXzc1RMtAG8CUyvT7P9/jwXA9pt5hbcPiZI2hyO8hzO5wZHsSJwePzfp86PzWf0ORPYVA1lFz90PE6eIY9oKjiCfqN0RsQAgJpxzNxXB2+qriAjD8j6xOIQGY8g5hU/bgJuRxzv0ClJKRpGhzHkbZWp4NWqyU1HOk36S1BsqCe52UdhplNMySd2triJR6pn1qtLh7UUmltR2cnXnntVZw5fRoqlQocp8dHPT3oPnQQhUKBlP3CoTAEQUB3VxcOHz0Cj8eDfC5H6jtSifDM6e/w7amT+KW/H6lkCu0dHdi3dy8S8Tg2burAU+3tOHH8OLbv2IGeg4cwPDR0ewtJk/G8ngzsdjdCd9MK4XAYly9dQiwWg7uxUdZ3OBzEip8fOYrHHl9F2jOWuT46ii1bt2LzlmchiiJZgM/nw7Evesk7K2SJ7tp164q7jOU4mE1mvPD8Tpw6eRL+Cb8sa2ltJRb79ZZ6pERcct+/bhXloinNMPB6R+D3B5BOp/HH4O+yK+12O1pbW3HxwgXyPfO+LSHJpLVGI17etQtOlwuRSIS4btmDy+C56kEwGMSSliWyvuQeqWD67oED+LL3mEwoEPBj2/Zt+LGvD9989TXWbdiAbDaLB5YuxRtv7sOe13cTa88sSiajUoFa9cijouSSGRhNJlgss0WmWDRKJp5BU3MzVBRFkrMR78ic1TmcTmQFgRCXLLFi5UoStENDV8iC/ouW1haMjY4hlUqR77a2NlD9/f3Y/9bbotfrndfhXqJteRve7+6m/gFGMd6iOtJxUAAAAABJRU5ErkJggg=='

interface SamsungResult {
    err?: unknown
    result?: string
    [key: string]: unknown
}

interface SamsungAds {
    initAd(options: AnyRecord): SamsungResult | void
    loadAd(options: { adFormat: string }): SamsungResult | void
    showAd(options: { adFormat: string }): SamsungResult | void
    addEventListener(event: string, callback: () => void): void
}

interface GSInstantSdk {
    initializeAsync(): Promise<SamsungResult | void>
    getLocale(): string
    setLoadingProgress?(rate: number): void
    canCreateShortCut(): SamsungResult | boolean
    setOnPauseCallback(callback: () => void): void
    setOnResumeCallback(callback: () => void): void
    startGameAsync(): Promise<SamsungResult | void>
    getLoginStatus(): SamsungResult
    loginAsync(): Promise<unknown>
    player: { getPlayerIdAsync(): Promise<string> }
    getDataAsync(keys: string[]): Promise<Record<string, unknown>>
    setDataAsync(data: Record<string, unknown>): Promise<unknown>
    createShortCut(): SamsungResult | void
    advertisement2?: SamsungAds
}

interface SamsungIapProduct {
    mItemId: string
    mItemName?: string
    mItemDesc?: string
    mItemPrice?: string | number
    mItemPriceString?: string
    mCurrencyCode?: string
    mCurrencyUnit?: string
    mItemImageUrl?: string
    mType?: string
    mConsumableYN?: string
    [key: string]: unknown
}

interface SamsungIapPurchase {
    mItemId: string
    mPurchaseId: string
    signedPurchaseRequest?: string
    [key: string]: unknown
}

interface SamsungIapConsume {
    mPurchaseId?: string
    mPurchaseID?: string
    mStatusCode: string | number
    mStatusString?: string
}

interface GSInstantIapSdk {
    getSupportedAPIs?(): string[]
    getProductListAsync(itemIDs?: string): Promise<SamsungIapProduct[]>
    purchaseItemAsync(config: { itemID: string; passThroughParam?: string }): Promise<SamsungIapPurchase>
    consumeItemsAsync(purchaseIDs: string): Promise<SamsungIapConsume[]>
    getOwnedListAsync(): Promise<SamsungIapPurchase[]>
}

declare global {
    interface Window {
        GSInstant?: GSInstantSdk
        GSInstantIAP?: GSInstantIapSdk
    }
}

function getResultError(result: SamsungResult | boolean | void): unknown {
    if (result && typeof result === 'object') {
        return result.err
    }
    return undefined
}

class SamsungPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.SAMSUNG
    }

    get platformLanguage(): string {
        return this.#platformLanguage || super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isAddToHomeScreenSupported(): boolean {
        return this.#canCreateShortCut
    }

    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    // payments
    get isPaymentsSupported(): boolean {
        return this.#isIapReady
    }

    #platformLanguage: string | null = null

    #canCreateShortCut = false

    #isIapReady = false

    #iapSetupDone = false

    #isAdInitialized = false

    #currentAdIsRewarded = false

    #isAdShowing = false

    #loadingDone = false

    #gracRatingBadge: HTMLDivElement | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        this.#setupIap()
        this.#createGracRatingBadge()

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const loadSdk = typeof window.GSInstant !== 'undefined'
                ? Promise.resolve()
                : addJavaScript(SDK_URL)

            loadSdk
                .then(() => waitFor('GSInstant'))
                .then(() => {
                    this._platformSdk = window.GSInstant as GSInstantSdk
                    return (this._platformSdk as GSInstantSdk).initializeAsync()
                })
                .then((result) => {
                    if (getResultError(result)) {
                        throw new Error(`Samsung initializeAsync failed: ${getResultError(result)}`)
                    }

                    const sdk = this._platformSdk as GSInstantSdk

                    const locale = sdk.getLocale()
                    if (typeof locale === 'string' && locale.length >= 2) {
                        this.#platformLanguage = locale.substring(0, 2).toLowerCase()
                    }

                    const shortcutCheck = sdk.canCreateShortCut()
                    this.#canCreateShortCut = Boolean(shortcutCheck) && !getResultError(shortcutCheck)

                    sdk.setOnPauseCallback(() => {
                        this._setPauseState(true)
                    })

                    sdk.setOnResumeCallback(() => {
                        this._setPauseState(false)
                    })

                    return this.#fetchPlayerData()
                })
                .then(() => {
                    this.#initializeAds()
                    return (this._platformSdk as GSInstantSdk).startGameAsync()
                })
                .then((result) => {
                    if (getResultError(result)) {
                        throw new Error(`Samsung startGameAsync failed: ${getResultError(result)}`)
                    }

                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                })
        }

        return promiseDecorator.promise
    }

    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        if (message === PLATFORM_MESSAGE.GAME_READY) {
            this.setLoadingProgress(100)
            this.#removeGracRatingBadge(4000)
            return Promise.resolve()
        }

        return super.sendMessage(message, options)
    }

    setLoadingProgress(percent: number): void {
        if (this.#loadingDone) {
            return
        }

        const sdk = this._platformSdk as GSInstantSdk | null
        if (sdk && typeof sdk.setLoadingProgress === 'function') {
            sdk.setLoadingProgress(percent >= 100 ? 101 : percent)
        }

        if (percent >= 100) {
            this.#loadingDone = true
        }
    }

    // player
    authorizePlayer(): Promise<unknown> {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            const sdk = this._platformSdk as GSInstantSdk
            sdk.loginAsync()
                .catch((error) => {
                    // Samsung rejects with {err: 'ALREADY_LOGGED_IN'} when the session
                    // is already authenticated — treat as success and proceed to fetch playerId.
                    if (error && (error as SamsungResult).err === 'ALREADY_LOGGED_IN') {
                        return undefined
                    }
                    throw error
                })
                .then(() => sdk.player.getPlayerIdAsync())
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._setPlatformStorageAvailable(true)
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
                .catch((error: unknown) => {
                    // Samsung loginAsync rejects with {err: '...'} objects;
                    // getPlayerIdAsync rejects with raw strings. Normalize to Error.
                    const message = (error && (error as SamsungResult).err)
                        || (typeof error === 'string' ? error : 'samsung_auth_failed')
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, new Error(String(message)))
                })
        }

        return promiseDecorator.promise
    }

    // storage
    async getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        await this.#ensureStorageReady()
        const result: Record<string, unknown> = {}
        await Promise.all(keys.map(async (key) => {
            const data = await (this._platformSdk as GSInstantSdk).getDataAsync([key])
            const value = data && data[key] !== undefined ? data[key] : null
            if (value !== null && value !== undefined && value !== '') {
                // The SDK may hand back a deserialized object; the cache holds serialized strings.
                result[key] = typeof value === 'string' ? value : JSON.stringify(value)
            }
        }))
        return result
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(Object.keys(data)
            .map((key) => (this._platformSdk as GSInstantSdk).setDataAsync({ [key]: data[key] as string })))
            .then(() => undefined)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        await this.#ensureStorageReady()
        return Promise.all(keys.map((key) => (this._platformSdk as GSInstantSdk).setDataAsync({ [key]: null })))
            .then(() => undefined)
    }

    // advertisement
    preloadInterstitial(): void {
        if (!this.#isAdInitialized) {
            return
        }

        const result = (this._platformSdk as GSInstantSdk).advertisement2!.loadAd({ adFormat: 'INTERSTITIAL' })
        if (getResultError(result)) {
            logger.warn('Samsung loadAd(INTERSTITIAL) error:', getResultError(result))
        }
    }

    showInterstitial(): void {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(false)
            return
        }

        this.#currentAdIsRewarded = false
        this.#isAdShowing = true
        const result = (this._platformSdk as GSInstantSdk).advertisement2!.showAd({ adFormat: 'INTERSTITIAL' })
        if (getResultError(result)) {
            logger.warn('Samsung showAd(INTERSTITIAL) error:', getResultError(result))
            this.#isAdShowing = false
            this._showAdFailurePopup(false)
            this.#reloadCurrentAd()
        }
    }

    preloadRewarded(): void {
        if (!this.#isAdInitialized) {
            return
        }

        const result = (this._platformSdk as GSInstantSdk).advertisement2!.loadAd({ adFormat: 'REWARD' })
        if (getResultError(result)) {
            logger.warn('Samsung loadAd(REWARD) error:', getResultError(result))
        }
    }

    showRewarded(): void {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(true)
            return
        }

        this.#currentAdIsRewarded = true
        this.#isAdShowing = true
        const result = (this._platformSdk as GSInstantSdk).advertisement2!.showAd({ adFormat: 'REWARD' })
        if (getResultError(result)) {
            logger.warn('Samsung showAd(REWARD) error:', getResultError(result))
            this.#isAdShowing = false
            this._showAdFailurePopup(true)
            this.#reloadCurrentAd()
        }
    }

    // social
    addToHomeScreen(): Promise<void> {
        const result = (this._platformSdk as GSInstantSdk).createShortCut()
        const err = getResultError(result)
        if (err) {
            return Promise.reject(new Error(String(err)))
        }

        return Promise.resolve()
    }

    // payments
    async paymentsPurchase(id: string): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject(new Error(`samsung_product_not_found: ${id}`))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            try {
                const iap = window.GSInstantIAP as GSInstantIapSdk
                const purchase = await iap.purchaseItemAsync({
                    itemID: product.platformProductId as string,
                    passThroughParam: this._paymentsGenerateTransactionId(id),
                })

                const mergedPurchase = { id, ...purchase }
                this._paymentsPurchases.push(mergedPurchase as AnyRecord & { id: string })
                this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
            } catch (error) {
                this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
            }
        }

        return promiseDecorator.promise
    }

    async paymentsConsumePurchase(id: string): Promise<unknown> {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject(new Error(`samsung_purchase_not_found: ${id}`))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            try {
                const iap = window.GSInstantIAP as GSInstantIapSdk
                const purchaseId = this._paymentsPurchases[purchaseIndex].mPurchaseId as string
                const results = await iap.consumeItemsAsync(purchaseId)
                const list = Array.isArray(results) ? results : [results].filter(Boolean)
                const result = list.find((r) => r.mPurchaseId === purchaseId || r.mPurchaseID === purchaseId)
                    ?? list[0]
                const statusCode = result?.mStatusCode != null ? String(result.mStatusCode) : '0'

                if (statusCode !== '0' && statusCode !== '4') {
                    throw new Error(result?.mStatusString || 'samsung_consume_failed')
                }

                this._paymentsPurchases.splice(purchaseIndex, 1)
                this._resolvePromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, { id, ...result })
            } catch (error) {
                this._rejectPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE, error)
            }
        }

        return promiseDecorator.promise
    }

    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject(new Error('samsung_no_products_configured'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            const itemIDs = products.map((p) => p.platformProductId as string).join(',')

            Promise.resolve()
                .then(() => (window.GSInstantIAP as GSInstantIapSdk).getProductListAsync(itemIDs))
                .then((samsungProducts) => {
                    const list = Array.isArray(samsungProducts) ? samsungProducts : []
                    const merged = products.map((product) => {
                        const sp = list.find((s) => s.mItemId === product.platformProductId)
                        const price = sp?.mItemPrice != null && sp?.mCurrencyCode
                            ? `${sp.mItemPrice} ${sp.mCurrencyCode}`
                            : sp?.mItemPriceString ?? null
                        return {
                            id: product.id,
                            title: sp?.mItemName ?? null,
                            description: sp?.mItemDesc ?? null,
                            price,
                            priceCurrencyCode: sp?.mCurrencyCode ?? null,
                            priceCurrencyImage: sp?.mItemImageUrl ?? null,
                            priceValue: sp?.mItemPrice != null ? Number(sp.mItemPrice) : null,
                        }
                    })
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, merged)
                })
                .catch((error) => {
                    logger.warn('Samsung getProductListAsync error:', error)
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, [])
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            const products = this._paymentsGetProductsPlatformData()

            Promise.resolve()
                .then(() => (window.GSInstantIAP as GSInstantIapSdk).getOwnedListAsync())
                .then((ownedList) => {
                    const list = Array.isArray(ownedList) ? ownedList : []
                    this._paymentsPurchases = list.map((purchase) => {
                        const product = products.find((p) => p.platformProductId === purchase.mItemId)
                        const id = (product?.id ?? purchase.mItemId) as string
                        return { id, ...purchase } as AnyRecord & { id: string }
                    })
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    logger.warn('Samsung getOwnedListAsync error:', error)
                    this._paymentsPurchases = []
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, [])
                })
        }

        return promiseDecorator.promise
    }

    #loadAd(format: 'INTERSTITIAL' | 'REWARD'): void {
        const ads = (this._platformSdk as GSInstantSdk).advertisement2
        if (!ads) {
            return
        }

        const result = ads.loadAd({ adFormat: format })
        if (getResultError(result)) {
            logger.warn(`Samsung loadAd(${format}) error:`, getResultError(result))
        }
    }

    #reloadCurrentAd(): void {
        this.#loadAd(this.#currentAdIsRewarded ? 'REWARD' : 'INTERSTITIAL')
    }

    #createGracRatingBadge(): void {
        if (this.#gracRatingBadge || typeof document === 'undefined') {
            return
        }

        const container = document.createElement('div')
        container.id = 'bridge-samsung-grac-rating'
        container.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;pointer-events:none;transition:opacity .5s'

        const img = document.createElement('img')
        img.src = GRAC_ALL_RATING_IMAGE
        img.alt = 'ALL'
        img.style.cssText = 'width:54px;height:auto;display:block;border-radius:3px'
        container.appendChild(img)

        document.body.appendChild(container)
        this.#gracRatingBadge = container

        setTimeout(() => this.#removeGracRatingBadge(0), 30000)
    }

    #removeGracRatingBadge(delay: number): void {
        const badge = this.#gracRatingBadge
        if (!badge) {
            return
        }
        this.#gracRatingBadge = null

        setTimeout(() => {
            badge.style.opacity = '0'
            setTimeout(() => badge.remove(), 600)
        }, delay)
    }

    #setupIap(): void {
        if (this.#iapSetupDone || typeof window.GSInstantIAP === 'undefined') {
            return
        }
        this.#iapSetupDone = true

        window.addEventListener('iapReady', () => {
            this.#isIapReady = true
        })

        try {
            const apis = window.GSInstantIAP.getSupportedAPIs?.()
            if (Array.isArray(apis) && apis.length > 0) {
                this.#isIapReady = true
            }
        } catch {
            this.#isIapReady = false
        }
    }

    #ensureStorageReady(): Promise<void> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }
        return Promise.resolve()
    }

    #fetchPlayerData(): Promise<void> {
        const sdk = this._platformSdk as GSInstantSdk
        const loginStatus = sdk.getLoginStatus()
        if (loginStatus && !loginStatus.err && loginStatus.result === 'LOGIN') {
            return sdk.player.getPlayerIdAsync()
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._setPlatformStorageAvailable(true)
                })
                .catch(() => {
                    this._isPlayerAuthorized = false
                    this._playerApplyGuestData()
                })
        }

        this._isPlayerAuthorized = false
        this._playerApplyGuestData()
        return Promise.resolve()
    }

    #initializeAds(): void {
        const ads = (this._platformSdk as GSInstantSdk).advertisement2
        if (!ads || typeof ads.initAd !== 'function') {
            logger.warn('Samsung advertisement2 API not available on this Galaxy Store Client')
            return
        }

        const options = this._options as AnyRecord
        const adOptions: AnyRecord = {}

        const interstitialPlacement = this.#resolveSamsungPlacement('interstitial')
        if (interstitialPlacement) {
            adOptions.samsungInterstitialAdPlacementId = interstitialPlacement
        }

        const rewardedPlacement = this.#resolveSamsungPlacement('rewarded')
        if (rewardedPlacement) {
            adOptions.samsungRewardedAdPlacementId = rewardedPlacement
        }

        if (options.admobInterstitialAdUnitId) {
            adOptions.admobInterstitialAdUnitId = options.admobInterstitialAdUnitId
        }
        if (options.admobRewardedAdUnitId) {
            adOptions.admobRewardedAdUnitId = options.admobRewardedAdUnitId
        }
        if (options.gameTitle) {
            adOptions.gameTitle = options.gameTitle
        }

        if (Object.keys(adOptions).length === 0) {
            return
        }

        const result = ads.initAd(adOptions)
        if (getResultError(result)) {
            logger.warn('Samsung ad init error:', getResultError(result))
            return
        }

        this.#isAdInitialized = true

        ads.addEventListener('AD_START', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.OPENED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            }
        })

        ads.addEventListener('AD_COMPLETE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
            this.#reloadCurrentAd()
        })

        ads.addEventListener('AD_SKIP', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
            this.#reloadCurrentAd()
        })

        ads.addEventListener('AD_CLOSE', () => {
            if (!this.#isAdShowing) {
                return
            }

            if (this.#currentAdIsRewarded) {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            } else {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            }
            this.#isAdShowing = false
            this.#reloadCurrentAd()
        })

        ads.addEventListener('AD_LOAD_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
        })

        ads.addEventListener('AD_SHOW_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
            this.#reloadCurrentAd()
        })

        ads.addEventListener('AD_VIDEO_ERROR', () => {
            if (!this.#isAdShowing) {
                return
            }

            this._showAdFailurePopup(this.#currentAdIsRewarded)
            this.#isAdShowing = false
            this.#reloadCurrentAd()
        })
    }

    #resolveSamsungPlacement(adType: string): string | null {
        const advertisement = (this._options as AnyRecord).advertisement as AnyRecord | undefined
        const adConfig = advertisement?.[adType] as AnyRecord | undefined
        const placements = adConfig?.placements as AnyRecord[] | undefined
        if (!Array.isArray(placements) || placements.length === 0) {
            return null
        }

        const fallbackId = adConfig?.placementFallback
        if (fallbackId) {
            const match = placements.find((p) => p.id === fallbackId)
            if (match?.[PLATFORM_ID.SAMSUNG]) {
                return match[PLATFORM_ID.SAMSUNG] as string
            }
        }

        const firstWithSamsung = placements.find((p) => p[PLATFORM_ID.SAMSUNG])
        return (firstWithSamsung?.[PLATFORM_ID.SAMSUNG] as string) ?? null
    }
}

export default SamsungPlatformBridge
