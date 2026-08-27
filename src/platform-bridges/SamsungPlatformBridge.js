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
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    STORAGE_TYPE,
    PLATFORM_MESSAGE,
} from '../constants'

const SDK_URL = 'https://gtg.samsungapps.com/gsinstant-sdk/gsinstant.0.45.js'

// eslint-disable-next-line max-len
const GRAC_ALL_RATING_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAFZUlEQVR4nM1Ya2xTZRh+Ttud057T07Vd23W9bCOETXAoeEEw4ZI4hjFBEMgiMdGf8sMLIP5RQwyJzgWm8UIg/nAI8ZLAHyRx6m+HMLnojAkbRbuNjvW2tV2vp5djzic7Y46etqMgT3JyvtP3/b7v+d73/b7v7UsFAgHs3b1HHDh3Dvl8Hv8HNBoNOp7ehPe6uihqZ2enOHB+APcDtjy3FdTipmZR+qC0FIxrjaipq7lnBEQREMYziJ6NAnmAZVloZoTmjWYYnqjFPcdyPSEW+zmKZDI5S4i2M4r92he1Y7XryYrmimWi+GTg45J6jHt2bplQKax2rsH6pvUVEZrOxND7Wy+mhZiiHqWi5LaqnIEpUHAaXKgUuhoWFtZSUZ+yCDFqBjzNV0xIo9KgTldXfUK6GhYGxoCFoIFvqD4hA8NDV6NbGCH9XSDkNrixUDh5V/UJOSsc9FY4eAfZFFUlZOWsCybEMzzYGra6hBoU4qAgFpAvFL+Upd1ZyYYoSUhFqWDWmYvKM7kMwqlQUTmtpmHSmqpHiFEzsLDFXZbOp+GZvKY4hrvWXT1CepqHUWssKo8Lcfwd+UtxDAfvrB6hes6mKJ9MTmIqNaWo49RXkZCNq1eUS/ETSgUVdawlFlUhIZuiPJQKI5QIK+qYdCYSi+VAc6endCgRRDQTgZAXyI4a/HMIY+MTsnxxsxvNixzgaA6bmzdjtWvNLX1D+OBsV2WE7Hq7onwicQPxbAIJIQFaRyMam8aEf9aFNosZWo0WNtYGl8GNh+tXyDJfzFeZy9SUGlbWpngoRtIRpLJJJHNJReL1JRZWFiEVpUIdWzyfyeVziGZiyIt5kh1W49ZXJGRlrSQuiiFbyCKajpB2IBG8I9eXFUMNJVYlZYTblm4va0In74Rv2nd3CTEaBi8+9BLKgXSeBZOhOyRkKP+ELYaRsXFMTyeg5WjQlrnuly7td9bux2XqIj7Dp6UJWRUu1XIhHQPSU2+zoNE1N2uQ0mLpr5UwlCkvqO1lBmK5KGc8RQs5KkzQJTS6HOC4+RminmNxPTaGH671zZNd8V6ZTygXzc1RMtAG8CUyvT7P9/jwXA9pt5hbcPiZI2hyO8hzO5wZHsSJwePzfp86PzWf0ORPYVA1lFz90PE6eIY9oKjiCfqN0RsQAgJpxzNxXB2+qriAjD8j6xOIQGY8g5hU/bgJuRxzv0ClJKRpGhzHkbZWp4NWqyU1HOk36S1BsqCe52UdhplNMySd2triJR6pn1qtLh7UUmltR2cnXnntVZw5fRoqlQocp8dHPT3oPnQQhUKBlP3CoTAEQUB3VxcOHz0Cj8eDfC5H6jtSifDM6e/w7amT+KW/H6lkCu0dHdi3dy8S8Tg2burAU+3tOHH8OLbv2IGeg4cwPDR0ewtJk/G8ngzsdjdCd9MK4XAYly9dQiwWg7uxUdZ3OBzEip8fOYrHHl9F2jOWuT46ii1bt2LzlmchiiJZgM/nw7Evesk7K2SJ7tp164q7jOU4mE1mvPD8Tpw6eRL+Cb8sa2ltJRb79ZZ6pERcct+/bhXloinNMPB6R+D3B5BOp/HH4O+yK+12O1pbW3HxwgXyPfO+LSHJpLVGI17etQtOlwuRSIS4btmDy+C56kEwGMSSliWyvuQeqWD67oED+LL3mEwoEPBj2/Zt+LGvD9989TXWbdiAbDaLB5YuxRtv7sOe13cTa88sSiajUoFa9cijouSSGRhNJlgss0WmWDRKJp5BU3MzVBRFkrMR78ic1TmcTmQFgRCXLLFi5UoStENDV8iC/ouW1haMjY4hlUqR77a2NlD9/f3Y/9bbotfrndfhXqJteRve7+6m/gFGMd6iOtJxUAAAAABJRU5ErkJggg=='

class SamsungPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.SAMSUNG
    }

    get platformLanguage() {
        return this._platformLanguage || super.platformLanguage
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // social
    get isAddToHomeScreenSupported() {
        return this.#canCreateShortCut
    }

    get isExternalLinksAllowed() {
        return false
    }

    // payments
    get isPaymentsSupported() {
        return this.#isIapReady
    }

    _platformLanguage = null

    #canCreateShortCut = false

    #isIapReady = false

    #iapSetupDone = false

    #isAdInitialized = false

    #currentAdIsRewarded = false

    #isAdShowing = false

    #loadingDone = false

    #gracRatingBadge = null

    initialize() {
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
                    this._platformSdk = window.GSInstant
                    return this._platformSdk.initializeAsync()
                })
                .then((result) => {
                    if (result && result.err) {
                        throw new Error(`Samsung initializeAsync failed: ${result.err}`)
                    }

                    const locale = this._platformSdk.getLocale()
                    if (typeof locale === 'string' && locale.length >= 2) {
                        this._platformLanguage = locale.substring(0, 2).toLowerCase()
                    }

                    const shortcutCheck = this._platformSdk.canCreateShortCut()
                    this.#canCreateShortCut = Boolean(shortcutCheck) && !shortcutCheck.err

                    this._platformSdk.setOnPauseCallback(() => {
                        this._setPauseState(true)
                    })

                    this._platformSdk.setOnResumeCallback(() => {
                        this._setPauseState(false)
                    })

                    return this.#fetchPlayerData()
                })
                .then(() => {
                    this.#initializeAds()
                    return this._platformSdk.startGameAsync()
                })
                .then((result) => {
                    if (result && result.err) {
                        throw new Error(`Samsung startGameAsync failed: ${result.err}`)
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

    sendMessage(message) {
        if (message === PLATFORM_MESSAGE.GAME_READY) {
            this.setLoadingProgress(101)
            this.#removeGracRatingBadge(4000)
            return Promise.resolve()
        }

        return super.sendMessage(message)
    }

    setLoadingProgress(percent) {
        if (this.#loadingDone) {
            return
        }

        if (typeof this._platformSdk?.setLoadingProgress === 'function') {
            this._platformSdk.setLoadingProgress(percent >= 100 ? 101 : percent)
        }

        if (percent >= 100) {
            this.#loadingDone = true
        }
    }

    // player
    authorizePlayer() {
        if (this._isPlayerAuthorized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            this._platformSdk.loginAsync()
                .catch((error) => {
                    // Samsung rejects with {err: 'ALREADY_LOGGED_IN'} when the session
                    // is already authenticated — treat as success and proceed to fetch playerId.
                    if (error && error.err === 'ALREADY_LOGGED_IN') {
                        return undefined
                    }
                    throw error
                })
                .then(() => this._platformSdk.player.getPlayerIdAsync())
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
                .catch((error) => {
                    // Samsung loginAsync rejects with {err: '...'} objects;
                    // getPlayerIdAsync rejects with raw strings. Normalize to Error.
                    const message = (error && error.err) || (typeof error === 'string' ? error : 'samsung_auth_failed')
                    this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, new Error(message))
                })
        }

        return promiseDecorator.promise
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
            return this._isPlayerAuthorized
        }

        return super.isStorageAvailable(storageType)
    }

    getDataFromStorage(key, storageType, tryParseJson) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const keys = Array.isArray(key) ? key : [key]

            return this._platformSdk.getDataAsync(keys)
                .then((data) => {
                    if (Array.isArray(key)) {
                        return key.map((k) => this.#readStorageValue(data, k, tryParseJson))
                    }

                    return this.#readStorageValue(data, key, tryParseJson)
                })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const dataObj = {}

            if (Array.isArray(key)) {
                for (let i = 0; i < key.length; i++) {
                    dataObj[key[i]] = this.#serializeStorageValue(value[i])
                }
            } else {
                dataObj[key] = this.#serializeStorageValue(value)
            }

            return this._platformSdk.setDataAsync(dataObj)
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            const keys = Array.isArray(key) ? key : [key]
            const dataObj = {}
            for (let i = 0; i < keys.length; i++) {
                dataObj[keys[i]] = null
            }

            return this._platformSdk.setDataAsync(dataObj)
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    preloadInterstitial() {
        if (!this.#isAdInitialized) {
            return
        }

        const result = this._platformSdk.advertisement2.loadAd({ adFormat: 'INTERSTITIAL' })
        if (result && result.err) {
            console.warn('Samsung loadAd(INTERSTITIAL) error:', result.err)
        }
    }

    showInterstitial() {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(false)
            return
        }

        this.#currentAdIsRewarded = false
        this.#isAdShowing = true
        const result = this._platformSdk.advertisement2.showAd({ adFormat: 'INTERSTITIAL' })
        if (result && result.err) {
            console.warn('Samsung showAd(INTERSTITIAL) error:', result.err)
            this.#isAdShowing = false
            this._showAdFailurePopup(false)
            this.#reloadCurrentAd()
        }
    }

    preloadRewarded() {
        if (!this.#isAdInitialized) {
            return
        }

        const result = this._platformSdk.advertisement2.loadAd({ adFormat: 'REWARD' })
        if (result && result.err) {
            console.warn('Samsung loadAd(REWARD) error:', result.err)
        }
    }

    showRewarded() {
        if (!this.#isAdInitialized) {
            this._showAdFailurePopup(true)
            return
        }

        this.#currentAdIsRewarded = true
        this.#isAdShowing = true
        const result = this._platformSdk.advertisement2.showAd({ adFormat: 'REWARD' })
        if (result && result.err) {
            console.warn('Samsung showAd(REWARD) error:', result.err)
            this.#isAdShowing = false
            this._showAdFailurePopup(true)
            this.#reloadCurrentAd()
        }
    }

    // social
    addToHomeScreen() {
        const result = this._platformSdk.createShortCut()
        if (result && result.err) {
            return Promise.reject(new Error(result.err))
        }

        return Promise.resolve()
    }

    // payments
    async paymentsPurchase(id) {
        const product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            return Promise.reject(new Error(`samsung_product_not_found: ${id}`))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            try {
                const purchase = await window.GSInstantIAP.purchaseItemAsync({
                    itemID: product.platformProductId,
                    passThroughParam: this._paymentsGenerateTransactionId(id),
                })

                const mergedPurchase = { id, ...purchase }
                this._paymentsPurchases.push(mergedPurchase)
                this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
            } catch (error) {
                this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
            }
        }

        return promiseDecorator.promise
    }

    async paymentsConsumePurchase(id) {
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject(new Error(`samsung_purchase_not_found: ${id}`))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            try {
                const purchaseId = this._paymentsPurchases[purchaseIndex].mPurchaseId
                const results = await window.GSInstantIAP.consumeItemsAsync(purchaseId)
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

    paymentsGetCatalog() {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject(new Error('samsung_no_products_configured'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            const itemIDs = products.map((p) => p.platformProductId).join(',')

            Promise.resolve()
                .then(() => window.GSInstantIAP.getProductListAsync(itemIDs))
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
                    console.warn('Samsung getProductListAsync error:', error)
                    this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, [])
                })
        }

        return promiseDecorator.promise
    }

    paymentsGetPurchases() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            const products = this._paymentsGetProductsPlatformData()

            Promise.resolve()
                .then(() => window.GSInstantIAP.getOwnedListAsync())
                .then((ownedList) => {
                    const list = Array.isArray(ownedList) ? ownedList : []
                    this._paymentsPurchases = list.map((purchase) => {
                        const product = products.find((p) => p.platformProductId === purchase.mItemId)
                        return { id: product?.id ?? purchase.mItemId, ...purchase }
                    })
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    console.warn('Samsung getOwnedListAsync error:', error)
                    this._paymentsPurchases = []
                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, [])
                })
        }

        return promiseDecorator.promise
    }

    #createGracRatingBadge() {
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

    #removeGracRatingBadge(delay) {
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

    #setupIap() {
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

    #loadAd(format) {
        const ads = this._platformSdk.advertisement2
        if (!ads) {
            return
        }

        const result = ads.loadAd({ adFormat: format })
        if (result && result.err) {
            console.warn(`Samsung loadAd(${format}) error:`, result.err)
        }
    }

    #reloadCurrentAd() {
        this.#loadAd(this.#currentAdIsRewarded ? 'REWARD' : 'INTERSTITIAL')
    }

    #fetchPlayerData() {
        const loginStatus = this._platformSdk.getLoginStatus()
        if (loginStatus && !loginStatus.err && loginStatus.result === 'LOGIN') {
            return this._platformSdk.player.getPlayerIdAsync()
                .then((playerId) => {
                    this._isPlayerAuthorized = true
                    this._playerId = playerId
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

    #initializeAds() {
        const ads = this._platformSdk.advertisement2
        if (!ads || typeof ads.initAd !== 'function') {
            console.warn('Samsung advertisement2 API not available on this Galaxy Store Client')
            return
        }

        const adOptions = {}

        const interstitialPlacement = this.#resolveSamsungPlacement('interstitial')
        if (interstitialPlacement) {
            adOptions.samsungInterstitialAdPlacementId = interstitialPlacement
        }

        const rewardedPlacement = this.#resolveSamsungPlacement('rewarded')
        if (rewardedPlacement) {
            adOptions.samsungRewardedAdPlacementId = rewardedPlacement
        }

        if (this._options.admobInterstitialAdUnitId) {
            adOptions.admobInterstitialAdUnitId = this._options.admobInterstitialAdUnitId
        }
        if (this._options.admobRewardedAdUnitId) {
            adOptions.admobRewardedAdUnitId = this._options.admobRewardedAdUnitId
        }
        if (this._options.gameTitle) {
            adOptions.gameTitle = this._options.gameTitle
        }

        if (Object.keys(adOptions).length === 0) {
            return
        }

        const result = ads.initAd(adOptions)
        if (result && result.err) {
            console.warn('Samsung ad init error:', result.err)
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

    #resolveSamsungPlacement(adType) {
        const placements = this._options.advertisement?.[adType]?.placements
        if (!Array.isArray(placements) || placements.length === 0) {
            return null
        }

        const fallbackId = this._options.advertisement?.[adType]?.placementFallback
        if (fallbackId) {
            const match = placements.find((p) => p.id === fallbackId)
            if (match?.[PLATFORM_ID.SAMSUNG]) {
                return match[PLATFORM_ID.SAMSUNG]
            }
        }

        const firstWithSamsung = placements.find((p) => p[PLATFORM_ID.SAMSUNG])
        return firstWithSamsung?.[PLATFORM_ID.SAMSUNG] ?? null
    }

    // eslint-disable-next-line class-methods-use-this
    #readStorageValue(data, key, tryParseJson) {
        let value = data && data[key] !== undefined ? data[key] : null
        if (tryParseJson && typeof value === 'string') {
            try {
                value = JSON.parse(value)
            } catch (_) {
                // keep value as is
            }
        }

        return value
    }

    // eslint-disable-next-line class-methods-use-this
    #serializeStorageValue(value) {
        if (value !== null && typeof value === 'object') {
            return JSON.stringify(value)
        }

        return value
    }
}

export default SamsungPlatformBridge
