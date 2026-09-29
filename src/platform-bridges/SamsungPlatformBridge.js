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

const GRAC_RATING_IMAGES = {
    ALL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAFZUlEQVR4nM1Ya2xTZRh+Ttud057T07Vd23W9bCOETXAoeEEw4ZI4hjFBEMgiMdGf8sMLIP5RQwyJzgWm8UIg/nAI8ZLAHyRx6m+HMLnojAkbRbuNjvW2tV2vp5djzic7Y46etqMgT3JyvtP3/b7v+d73/b7v7UsFAgHs3b1HHDh3Dvl8Hv8HNBoNOp7ehPe6uihqZ2enOHB+APcDtjy3FdTipmZR+qC0FIxrjaipq7lnBEQREMYziJ6NAnmAZVloZoTmjWYYnqjFPcdyPSEW+zmKZDI5S4i2M4r92he1Y7XryYrmimWi+GTg45J6jHt2bplQKax2rsH6pvUVEZrOxND7Wy+mhZiiHqWi5LaqnIEpUHAaXKgUuhoWFtZSUZ+yCDFqBjzNV0xIo9KgTldXfUK6GhYGxoCFoIFvqD4hA8NDV6NbGCH9XSDkNrixUDh5V/UJOSsc9FY4eAfZFFUlZOWsCybEMzzYGra6hBoU4qAgFpAvFL+Upd1ZyYYoSUhFqWDWmYvKM7kMwqlQUTmtpmHSmqpHiFEzsLDFXZbOp+GZvKY4hrvWXT1CepqHUWssKo8Lcfwd+UtxDAfvrB6hes6mKJ9MTmIqNaWo49RXkZCNq1eUS/ETSgUVdawlFlUhIZuiPJQKI5QIK+qYdCYSi+VAc6endCgRRDQTgZAXyI4a/HMIY+MTsnxxsxvNixzgaA6bmzdjtWvNLX1D+OBsV2WE7Hq7onwicQPxbAIJIQFaRyMam8aEf9aFNosZWo0WNtYGl8GNh+tXyDJfzFeZy9SUGlbWpngoRtIRpLJJJHNJReL1JRZWFiEVpUIdWzyfyeVziGZiyIt5kh1W49ZXJGRlrSQuiiFbyCKajpB2IBG8I9eXFUMNJVYlZYTblm4va0In74Rv2nd3CTEaBi8+9BLKgXSeBZOhOyRkKP+ELYaRsXFMTyeg5WjQlrnuly7td9bux2XqIj7Dp6UJWRUu1XIhHQPSU2+zoNE1N2uQ0mLpr5UwlCkvqO1lBmK5KGc8RQs5KkzQJTS6HOC4+RminmNxPTaGH671zZNd8V6ZTygXzc1RMtAG8CUyvT7P9/jwXA9pt5hbcPiZI2hyO8hzO5wZHsSJwePzfp86PzWf0ORPYVA1lFz90PE6eIY9oKjiCfqN0RsQAgJpxzNxXB2+qriAjD8j6xOIQGY8g5hU/bgJuRxzv0ClJKRpGhzHkbZWp4NWqyU1HOk36S1BsqCe52UdhplNMySd2triJR6pn1qtLh7UUmltR2cnXnntVZw5fRoqlQocp8dHPT3oPnQQhUKBlP3CoTAEQUB3VxcOHz0Cj8eDfC5H6jtSifDM6e/w7amT+KW/H6lkCu0dHdi3dy8S8Tg2burAU+3tOHH8OLbv2IGeg4cwPDR0ewtJk/G8ngzsdjdCd9MK4XAYly9dQiwWg7uxUdZ3OBzEip8fOYrHHl9F2jOWuT46ii1bt2LzlmchiiJZgM/nw7Evesk7K2SJ7tp164q7jOU4mE1mvPD8Tpw6eRL+Cb8sa2ltJRb79ZZ6pERcct+/bhXloinNMPB6R+D3B5BOp/HH4O+yK+12O1pbW3HxwgXyPfO+LSHJpLVGI17etQtOlwuRSIS4btmDy+C56kEwGMSSliWyvuQeqWD67oED+LL3mEwoEPBj2/Zt+LGvD9989TXWbdiAbDaLB5YuxRtv7sOe13cTa88sSiajUoFa9cijouSSGRhNJlgss0WmWDRKJp5BU3MzVBRFkrMR78ic1TmcTmQFgRCXLLFi5UoStENDV8iC/ouW1haMjY4hlUqR77a2NlD9/f3Y/9bbotfrndfhXqJteRve7+6m/gFGMd6iOtJxUAAAAABJRU5ErkJggg==',
    12: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAFJklEQVR42s2YW2zTVRzHP/+2623txq4tLRu7duyGrDgyYPBgYOgDeIEYfTUaNYoBRAVJjA+ySdQ3IxgFUYkSwBd5MFFjQCSMbYg4ZGMXdoOt7boNNtat/7U9Pgy6TdfuXjhPTc43v37O73r+R3K5XOzasVNUVVbi9/t5EEulUlH2+Cb2V1RIypttbeLihUqEEDyoFQgEaGxoxOHoel/KXJomACSVltiMDURFJ0YUxnung/7WsxDwodfrUd3fiMvZTMzS0oh7J3pxEQhBf8tveDyeMSC10TJDU4LM5ADmRXMPdYdiCb+33Mun2RrJNvuxpwdQSHP30nD3mJEZA0mSwJ7mJ9scQJoCxmoxkZZiJTkxHqPBQFTU6N/Jskz/wCBdzm7qG29MrLiZwMToAhRn+EmODR+mxPg41pbYSYyPm3RfrVaTmKAmMSGOvJwshvp7+GH6QIIEgyDLHCAtMYBCEV692JRE2WOlqJTKaR1SqVSw2JQ0PQ9tKBghRi/QqKbb4JSUlqycNsykNsK63iimzJPxKycrA6Mhem5dez57ii0zDSnECYQQVF+upcvRTbG9EIs5eVKdYr5gdFothmh9yH2ny03ttQbcvX1cuVo/Ow+dqVMRdS8dFJIg2xwgKWbyCtNq1KhUoXOnu6cv+HtkZGR2QI7bEx3oHpB4YoUvCDmxWpQowpSgV5bH4LWakLoZhWzQKzHim11Ifb6xq80Si3l+gGDuc0KtVmPLTFv4KnP39nH42Kkpdbm2DFQq1Xx5aG5Lo1FTmGsLq4kokH15PhqN+uEASrGayclOn1IXESCtRsOaVXaUCsXDAbSicFnYLh5RoIT4OHKyMsJqut29kQGSJIlV9sKwI6V/4C51Dc2RASrMs4Wc6gB+v58L1ZeRx802xcKFahH2R/LDauobW7jZ6Vz4HJIkWF1cFLaqBj1D/FV7LTJJbctMx5SUEPqWLgR/XvmHYa+88EA6rYZHiwrCapwuN403Whe+7BUKBetWF6PVhL7vDA97OVdZQ6i3jeDY9Q33zUtVLbGYwmr8gQDFRcsRQiAQeL0yLfV//x+o7/ppFEo1Kn1SWIM93SN41KFOZ6OpsWkGrwOCutpafjr941hB3H+OeVjWjHNIp9NhMBjQ6/XBbmwwGEaHqE6HVqsNavV6PbGxsSFtGYxGlP/5qJxwdcvMyuLNt3bzxaHPefb55+ho7yAvP58d27fz8quv4HK5MJvNLMvNxelwUrF/P58e/IzWlhaQJPrv3MHn83Hky8McP3GCmppqBu8OsqFsI3vf2cPtvj42bipjzdq1nDp5kq3btvHJRx/TcP365B5qbmpioH8AjVbL8e++p+riReLiFhEIBIiKUpOSksq69euDeovFgsFg4NDBg5SUlAS9ZjQaab7RzOYtW9jy1JOAhCx7uXXrFkePfEVHe3vwCXG8vUlDdl8ohGDvvn288drrSJJEkb2I1NRU/jh3Lqj1eDwYjUa0Gi1erxdZHp1Jao2Grs4unE4Xw8NertbWotPqADCZTBTZ7VyqrgHgUk3N9HKo/MMKnE4HL7z0Inn5eVRXVeFwOkhLH7v1ud1uzp45ywfl5Xx99Cg+3yiQy+nk6a3P8OsvP3Ps228oXVeKV5bJttl4e+8edu/cRW9vb/BQ4/uYtMq+UvT09Ew7qa1WK/poPbIs09baNmHPYrUihKCrszPoCVWUivq6uknbgS3HRkd7B0NDQwAUFBQgnT9/nvfe3SdaW1sfaLkXFBZQfuCA9C9b/r5AWBzSCwAAAABJRU5ErkJggg==',
    15: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAApCAYAAABdnotGAAAEoElEQVR42u2YW2xTdRzHP+f0sq2l121uHesYK2MX622gMcjgSUAE0cEDGvXJCLwpkWggGhJRwovGC8MHZAo8+MJ4QYKaQAwQu4EGBrp0ZVt3aTbWbuvarqzt6Tk+DDYWythK6CTye/uf3//yPf//93cVBgYG2P7e+0qzy0UymWQuRK1Ws2rNaj7bu1dQ9XZ1KU1/uFAUhbkSWZbxtHno7+/bLTgWlCoA83JE3lltpeQxTeaQKPB31xiHTwdJSAo6nQ71Ld321/LYvNKc8dtZs9SArEDDb8NEo9FJQIvnZ816s7isoS9RfN+giuw6YHicT+luEk3m8HvoRQJSwX0DaotdBS6lD2gokcuZ0Cqi8rwp38vLFmCfb5v1fllCnGO3LG42C5OKSOsNJy2jS0imWJprNbNwweyf8Jo7b9IFzOx5dHhjDtw3qonIxgfrk6ZTXorU4I0tIiwbASEzTnI65UjSQlg2ZdZrZ+qgsbEYfdf9KXXX/YHMAwqOhDh91pXa7FvbZgboKf1flGZ3TIz74kV4xqoeKJ+mBWRWD2NWD0+MS7SdBCUrfqkw7QML8nNZvKgUi8mEWq0iFB4lFOhP78kEAcyqobQAaTRqVi57FsfCEgRh8oYtZhPO6sXpc0gU0ktTcq0Wcq2We+/Pf0z+v4BkWebMuSZ+On6S4ZHQ3AMaHArS4e1hdDRKq7t97gHdXkAkJCkzocN18TKui5cfkfrhifbVFQ5KS1JnjENDQVx/Xs4sIKNhHraC/NRh5xGHHgGagcRi8bvqtFlaRHGcSbqc7HuTun84AeTcF6DpYpTVbOL5pU/jHxziyccrpqaw7hQp7BeNAbK1IiX503c/fKNBAvHrqeu38Ajz8y2oVKq7/r0t10y3t+tm80Ph6pUrHDp4cNIab7VjHjrHmJ2TgyLL6PV6tFlZJCUJv9+PVquloLCQ3p4ezBYLSUkiFAohiiLFdjsqlQpfby/xeByNRoPBYAAgEomQm5fHYCBAPD7JPZXVbN490SwoL+fbA/X4fD6+/Por9Ho9NlsR1zwetmzbSrHdzrIXlrFx0yaqqqtpbmri+4YGjEYjL61di8NRhq3IRkd7Oyd//QW9TsdCRxmf7tlDc3MzGrWateteZvsHOwiHQ2zZtpXWf1oZHBxMbWUej4furu5xS9DrqaisZPMbryOKInq9nuLiYmpXrJiYX1hYiJSUOHL4R6qqq9BqtePVisVCm9vNKxs2sG79eqLRKIqi4PP5+OFQA50dHYRDYQDqNtbNzOy/qz/Axzt3YTAYMZlMPFNTQ2lpKefOnp2YE4lEMBlNmE1mJElCupnnxGMxOtrbCQQCJOJxWlpaiI2NAVDmcOAoX8TFCxcAaDzWOD2gSCRCIpGgtraWb+r309vTTZnDwfFjjbjdbuz2kom5gUCAU6dOseOjDzmwvx5Zlser1GCQV+vq+PnECY4eOcry5csRBIHKqirefPsttr27hWg0eqdTFEWE52qWKLe/4b3EarVOIfXtYrFaJ0htMBioqKxEFAU6OzvxD9xZ19uKiqaQ2ul0Ipw/f55Pdu5SvF7vnJq78wknn+/bJ/wLGcy9zrA4Z0wAAAAASUVORK5CYII=',
    18: 'data:image/png;base64,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',
}

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

        const requestedRating = String(this._options.gracRating ?? 'ALL').toUpperCase()
        const rating = GRAC_RATING_IMAGES[requestedRating] ? requestedRating : 'ALL'

        const img = document.createElement('img')
        img.src = GRAC_RATING_IMAGES[rating]
        img.alt = rating
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
