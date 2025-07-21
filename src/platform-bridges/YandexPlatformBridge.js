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
    DEVICE_TYPE,
    BANNER_STATE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = '/sdk.js'

class YandexPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.YANDEX
    }

    get platformLanguage() {
        if (this._platformSdk) {
            return this._platformSdk.environment.i18n.lang.toLowerCase()
        }

        return super.platformLanguage
    }

    get platformTld() {
        if (this._platformSdk) {
            return this._platformSdk.environment.i18n.tld.toLowerCase()
        }

        return super.platformTld
    }

    get isPlatformGetAllGamesSupported() {
        return true
    }

    get isPlatformGetGameByIdSupported() {
        return true
    }

    // advertisement
    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }

    // device
    get deviceType() {
        switch (this._platformSdk && this._platformSdk.deviceInfo.type) {
            case DEVICE_TYPE.DESKTOP: {
                return DEVICE_TYPE.DESKTOP
            }
            case DEVICE_TYPE.MOBILE: {
                return DEVICE_TYPE.MOBILE
            }
            case DEVICE_TYPE.TABLET: {
                return DEVICE_TYPE.TABLET
            }
            case DEVICE_TYPE.TV: {
                return DEVICE_TYPE.TV
            }
            default: {
                return super.deviceType
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported() {
        return true
    }

    // social
    get isAddToHomeScreenSupported() {
        return this.#isAddToHomeScreenSupported
    }

    get isRateSupported() {
        return true
    }

    get isExternalLinksAllowed() {
        return false
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    // config
    get isRemoteConfigSupported() {
        return true
    }

    #isAddToHomeScreenSupported = false

    #yandexPlayer = null

    #yandexPayments = null

    #playerPromise = null

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => {
                    waitFor('YaGames', 'init')
                        .then(() => {
                            window.YaGames.init()
                                .then((sdk) => {
                                    this._platformSdk = sdk

                                    this.#playerPromise = this.#getPlayer()

                                    const reportPluginEnginePromise = this._platformSdk
                                        .features
                                        .PluginEngineDataReporterAPI?.report({
                                            engineName: '',
                                            engineVersion: '',
                                            pluginName: PLUGIN_NAME,
                                            pluginVersion: PLUGIN_VERSION,
                                        })

                                    const checkAddToHomeScreenSupportedPromise = this._platformSdk
                                        .shortcut
                                        .canShowPrompt()
                                        .then((prompt) => {
                                            this.#isAddToHomeScreenSupported = prompt.canShow
                                        })

                                    const checkAddToHomeScreenSupportedTimeoutPromise = new Promise((resolve) => {
                                        setTimeout(resolve, 1000)
                                    })
                                    const checkAddToHomeScreenSupportedRacePromise = Promise.race([
                                        checkAddToHomeScreenSupportedPromise,
                                        checkAddToHomeScreenSupportedTimeoutPromise,
                                    ])

                                    const getPaymentsPromise = this._platformSdk.getPayments()
                                        .then((payments) => {
                                            this.#yandexPayments = payments
                                        })

                                    this._isBannerSupported = true
                                    const getBannerStatePromise = this._platformSdk.adv.getBannerAdvStatus()
                                        .then((data) => {
                                            if (data.stickyAdvIsShowing) {
                                                this._setBannerState(BANNER_STATE.SHOWN)
                                            }
                                        })

                                    Promise.all([
                                        reportPluginEnginePromise,
                                        checkAddToHomeScreenSupportedRacePromise,
                                        getPaymentsPromise,
                                        getBannerStatePromise,
                                    ])
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

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.features.LoadingAPI?.ready()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STARTED: {
                this._platformSdk.features.GameplayAPI?.start()
                return Promise.resolve()
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED: {
                this._platformSdk.features.GameplayAPI?.stop()
                return Promise.resolve()
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    getServerTime() {
        return new Promise((resolve) => {
            const ts = this._platformSdk.serverTime()
            resolve(ts)
        })
    }

    getAllGames() {
        return new Promise((resolve, reject) => {
            this._platformSdk.features.GamesAPI.getAllGames()
                .then(({ games }) => {
                    resolve(games)
                })
                .catch(reject)
        })
    }

    getGameById(options) {
        if (!options?.gameId) {
            return Promise.reject(new Error('Provide gameId'))
        }

        return new Promise((resolve, reject) => {
            this._platformSdk.features.GamesAPI.getGameByID(options?.gameId)
                .then(({ game, isAvailable }) => {
                    resolve({ ...game, isAvailable })
                })
                .catch(reject)
        })
    }

    // player
    authorizePlayer(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)

            if (this._isPlayerAuthorized) {
                this.#playerPromise = this.#getPlayer(options)

                this.#playerPromise.then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                })
            } else {
                this._platformSdk.auth.openAuthDialog()
                    .then(() => {
                        this.#playerPromise = this.#getPlayer(options)
                        this.#playerPromise.then(() => {
                            this._resolvePromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER)
                        })
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.AUTHORIZE_PLAYER, error)
                    })
            }
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
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return this.#playerPromise.then(() => new Promise((resolve) => {
                if (Array.isArray(key)) {
                    const values = []

                    for (let i = 0; i < key.length; i++) {
                        const value = typeof this._platformStorageCachedData[key[i]] === 'undefined'
                            ? null
                            : this._platformStorageCachedData[key[i]]

                        values.push(value)
                    }

                    resolve(values)
                    return
                }

                resolve(typeof this._platformStorageCachedData[key] === 'undefined' ? null : this._platformStorageCachedData[key])
            }))
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return this.#playerPromise.then(() => new Promise((resolve, reject) => {
                const data = this._platformStorageCachedData !== null
                    ? { ...this._platformStorageCachedData }
                    : {}

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = value[i]
                    }
                } else {
                    data[key] = value
                }

                this.#yandexPlayer.setData(data)
                    .then(() => {
                        this._platformStorageCachedData = data
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            }))
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            if (!this._isPlayerAuthorized) {
                return Promise.reject()
            }

            return this.#playerPromise.then(() => new Promise((resolve, reject) => {
                const data = this._platformStorageCachedData !== null
                    ? { ...this._platformStorageCachedData }
                    : {}

                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        delete data[key[i]]
                    }
                } else {
                    delete data[key]
                }

                this.#yandexPlayer.setData(data)
                    .then(() => {
                        this._platformStorageCachedData = data
                        resolve()
                    })
                    .catch((error) => {
                        reject(error)
                    })
            }))
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showBanner() {
        this._platformSdk.adv.showBannerAdv()
            .then((data) => {
                if (data.stickyAdvIsShowing) {
                    this._setBannerState(BANNER_STATE.SHOWN)
                } else {
                    this._setBannerState(BANNER_STATE.FAILED)
                }
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        this._platformSdk.adv.hideBannerAdv()
            .then((data) => {
                if (!data.stickyAdvIsShowing) {
                    this._setBannerState(BANNER_STATE.HIDDEN)
                }
            })
    }

    showInterstitial() {
        this._platformSdk.adv.showFullscreenAdv({
            callbacks: {
                onOpen: () => {
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                },
                onClose: (wasShown) => {
                    if (wasShown) {
                        this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                    } else {
                        this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
                    }
                },
                onError: (err) => {
                    console.error(err)
                },
            },
        })
    }

    showRewarded() {
        this._platformSdk.adv.showRewardedVideo({
            callbacks: {
                onOpen: () => {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                },
                onRewarded: () => {
                    this._setRewardedState(REWARDED_STATE.REWARDED)
                },
                onClose: () => {
                    this._setRewardedState(REWARDED_STATE.CLOSED)
                },
                onError: () => {
                    this._setRewardedState(REWARDED_STATE.FAILED)
                },
            },
        })
    }

    checkAdBlock() {
        return new Promise((resolve) => {
            // yandex shows ads even when adblock is on
            resolve(false)
        })
    }

    // social
    addToHomeScreen() {
        if (!this.isAddToHomeScreenSupported) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)

            this._platformSdk.shortcut.showPrompt()
                .then((result) => {
                    if (result.outcome === 'accepted') {
                        this._resolvePromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                        return
                    }

                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.ADD_TO_HOME_SCREEN, error)
                })
        }

        return promiseDecorator.promise
    }

    rate() {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.RATE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.RATE)

            this._platformSdk.feedback.canReview()
                .then((result) => {
                    if (result.value) {
                        this._platformSdk.feedback.requestReview()
                            .then(({ feedbackSent }) => {
                                if (feedbackSent) {
                                    this._resolvePromiseDecorator(ACTION_NAME.RATE)
                                    return
                                }

                                this._rejectPromiseDecorator(ACTION_NAME.RATE)
                            })
                            .catch((error) => {
                                this._rejectPromiseDecorator(ACTION_NAME.RATE, error)
                            })

                        return
                    }

                    this._rejectPromiseDecorator(ACTION_NAME.RATE, result.reason)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.RATE, error)
                })
        }

        return promiseDecorator.promise
    }

    // leaderboards
    leaderboardsSetScore(id, score) {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            this._platformSdk.leaderboards.setScore(id, score)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsGetEntries(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES)

            const options = {
                quantityTop: 20,
            }

            if (this._isPlayerAuthorized) {
                options.includeUser = true
                options.quantityAround = 3
            }

            this._platformSdk.leaderboards.getEntries(id, options)
                .then((result) => {
                    let entries

                    if (result && result.entries.length > 0) {
                        entries = result.entries.map((e) => ({
                            id: e.player.uniqueID,
                            name: e.player.publicName,
                            score: e.score,
                            rank: e.rank,
                            photo: e.player.getAvatarSrc('large'),
                        }))
                    } else {
                        entries = []
                    }

                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, entries)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_GET_ENTRIES, error)
                })
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id) {
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this.#yandexPayments.purchase(product)
                .then((purchase) => {
                    const mergedPurchase = { id, ...purchase.purchaseData }
                    delete mergedPurchase.productID

                    this._paymentsPurchases.push(mergedPurchase)
                    this._resolvePromiseDecorator(ACTION_NAME.PURCHASE, mergedPurchase)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.PURCHASE, error)
                })
        }

        return promiseDecorator.promise
    }

    paymentsConsumePurchase(id) {
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this.#yandexPayments.consumePurchase(this._paymentsPurchases[purchaseIndex].purchaseToken)
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

    paymentsGetCatalog() {
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        const products = this._paymentsGetProductsPlatformData()
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this.#yandexPayments.getCatalog()
                .then((yandexProducts) => {
                    const mergedProducts = products.map((product) => {
                        const yandexProduct = yandexProducts.find((p) => p.id === product.id)

                        return {
                            id: product.id,
                            title: yandexProduct.title,
                            description: yandexProduct.description,
                            imageURI: yandexProduct.imageURI,
                            price: yandexProduct.price,
                            priceCurrencyCode: yandexProduct.priceCurrencyCode,
                            priceValue: yandexProduct.priceValue,
                            priceCurrencyImage: yandexProduct.getPriceCurrencyImage?.('medium'),
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

    paymentsGetPurchases() {
        if (!this.#yandexPayments) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this.#yandexPayments.getPurchases()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)
                        const mergedPurchase = {
                            id: product.id,
                            ...purchase.purchaseData,
                        }

                        delete mergedPurchase.productID
                        return mergedPurchase
                    })

                    this._resolvePromiseDecorator(ACTION_NAME.GET_PURCHASES, this._paymentsPurchases)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_PURCHASES, error)
                })
        }

        return promiseDecorator.promise
    }

    // config
    getRemoteConfig(options) {
        if (!this._platformSdk) {
            return Promise.reject()
        }

        let remoteConfigOptions = options
        if (!remoteConfigOptions) {
            remoteConfigOptions = {}
        }

        if (!remoteConfigOptions.clientFeatures) {
            remoteConfigOptions.clientFeatures = []
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG)

            this._platformSdk.getFlags(remoteConfigOptions)
                .then((result) => {
                    this._resolvePromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, result)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.GET_REMOTE_CONFIG, error)
                })
        }
        return promiseDecorator.promise
    }

    // clipboard
    clipboardWrite(text) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE)

            this._platformSdk.clipboard.writeText(text)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, true)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.CLIPBOARD_WRITE, error)
                })
        }

        return promiseDecorator.promise
    }

    #getPlayer(options) {
        return new Promise((resolve) => {
            const parameters = {
                scopes: false,
            }

            if (options && typeof options.scopes === 'boolean') {
                parameters.scopes = options.scopes
            }

            this._platformSdk.getPlayer(parameters)
                .then((player) => {
                    this._playerId = player.getUniqueID()
                    this._isPlayerAuthorized = player.isAuthorized()

                    this._defaultStorageType = this._isPlayerAuthorized
                        ? STORAGE_TYPE.PLATFORM_INTERNAL
                        : STORAGE_TYPE.LOCAL_STORAGE

                    const name = player.getName()
                    if (name !== '') {
                        this._playerName = name
                    }

                    this._playerPhotos = []
                    const photoSmall = player.getPhoto('small')
                    const photoMedium = player.getPhoto('medium')
                    const photoLarge = player.getPhoto('large')

                    if (photoSmall) {
                        this._playerPhotos.push(photoSmall)
                    }

                    if (photoMedium) {
                        this._playerPhotos.push(photoMedium)
                    }

                    if (photoLarge) {
                        this._playerPhotos.push(photoLarge)
                    }

                    this.#yandexPlayer = player

                    return player.getData()
                })
                .then((data) => {
                    this._platformStorageCachedData = data
                })
                .finally(() => {
                    resolve()
                })
        })
    }
}

export default YandexPlatformBridge
