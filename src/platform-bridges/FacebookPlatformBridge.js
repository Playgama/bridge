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
    addJavaScript,
    createLoadingOverlay,
    isBase64Image,
    waitFor,
} from '../common/utils'
import {
    PLATFORM_ID,
    ACTION_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
    LEADERBOARD_TYPE,
} from '../constants'

const SDK_URL = 'https://connect.facebook.net/en_US/fbinstant.8.0.js'

const LEADERBOARD_XML = `
    <View style="position: fixed; top: 0px; left: 0px; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center" onTapEvent="close">
        <View style="position: relative; background-color: #2E3C75;color: #fff;padding: 20px;border-radius: 10px;box-shadow: 0 0 10px #2E3C75;font-size: 24px;text-align: center;min-width: 250px;max-width: 30%;max-height: 80%;overflow: auto;flex-direction: column;justify-content: center;align-items: center;">
            <View style="display: flex; flex-direction: column; align-items: center; justify-content: center;" onTapEvent="leaderboard">
                <For source="{{players}}" itemName="player">
                    <View style="display: flex;align-items: center;justify-content: space-between;width: 100%;gap: 10px;">
                      <Image src="{{FBInstant.players[{{player.sessionID}}].photo}}" style="width: 50px; height: 50px; border-radius: 50%" />
                      <Text content="{{FBInstant.players[{{player.sessionID}}].name}}" style="flex: 1; text-align: start;" />
                      <Text content="{{player.score}}" />
                    </View>
                </For>
            </View>
        </View>
    </View>
`

class FacebookPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId() {
        return PLATFORM_ID.FACEBOOK
    }

    get platformLanguage() {
        return this._platformLanguage || super.platformLanguage
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
        switch (this._platformSdk && this._platformSdk.getPlatform()) {
            case 'IOS':
            case 'ANDROID':
            case 'MOBILE_WEB': {
                return DEVICE_TYPE.MOBILE
            }
            case 'WEB': {
                return DEVICE_TYPE.DESKTOP
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

    // advertisement
    get isBannerSupported() {
        return true
    }

    // leaderboards
    get leaderboardsType() {
        return LEADERBOARD_TYPE.NATIVE_POPUP
    }

    // payments
    get isPaymentsSupported() {
        return true
    }

    // social
    get isInviteFriendsSupported() {
        return this._supportedApis.includes('inviteAsync')
    }

    get isJoinCommunitySupported() {
        return this._isJoinCommunitySupported
    }

    get isShareSupported() {
        return this._supportedApis.includes('shareAsync')
    }

    _contextId = null

    _supportedApis = []

    _preloadedInterstitialPromises = {}

    _preloadedRewardedPromises = {}

    _defaultStorageType = STORAGE_TYPE.PLATFORM_INTERNAL

    _isJoinCommunitySupported = false

    #leaderboardClicked = false

    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            addJavaScript(SDK_URL)
                .then(() => waitFor('FBInstant'))
                .then(() => {
                    this._platformSdk = window.FBInstant
                    return this._platformSdk.initializeAsync()
                })
                .then(() => {
                    this._isPlayerAuthorized = true
                    this._playerId = this._platformSdk.player.getID()
                    this._contextId = this._platformSdk.context.getID()

                    this._platformLanguage = this._platformSdk.getLocale()
                    if (typeof this._platformLanguage === 'string') {
                        this._platformLanguage = this._platformLanguage.substring(0, 2).toLowerCase()
                    }

                    this._supportedApis = this._platformSdk.getSupportedAPIs()

                    this.#setupLeaderboards()

                    return Promise.allSettled([
                        this._platformSdk.community.canFollowOfficialPageAsync(),
                        this._platformSdk.community.canJoinOfficialGroupAsync(),
                    ]).then(([pageFollow, groupJoin]) => {
                        const canFollow = pageFollow.status === 'fulfilled' ? pageFollow.value : false
                        const canJoin = groupJoin.status === 'fulfilled' ? groupJoin.value : false
                        this._isJoinCommunitySupported = (canFollow === true && canJoin === true)
                    })
                })
                .then(() => {
                    this._isInitialized = true
                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                })
                .catch((e) => this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, e))
        }

        return promiseDecorator.promise
    }

    // platform
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                this._platformSdk.setLoadingProgress(100)

                if (this._options.subscribeForNotificationsOnStart) {
                    setTimeout(() => this.#subscribeBotAsync(), 0)
                }

                return new Promise((resolve) => {
                    this._platformSdk.startGameAsync().then(resolve)
                })
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }

    // player
    authorizePlayer() {
        return Promise.resolve()
    }

    // storage
    isStorageSupported(storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return this._supportedApis.includes('player.getDataAsync')
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
            return new Promise((resolve, reject) => {
                const keys = Array.isArray(key) ? key : [key]

                this._platformSdk.player.getDataAsync(keys)
                    .then((userData) => {
                        const data = keys.map((_key) => {
                            const value = userData[_key]
                            return !tryParseJson && typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? null
                        })

                        resolve(data)
                    })
                    .catch(reject)
            })
        }

        return super.getDataFromStorage(key, storageType, tryParseJson)
    }

    setDataToStorage(key, value, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = value[i]
                    }
                } else {
                    data[key] = value
                }

                this._platformSdk.player.setDataAsync(data)
                    .then(resolve)
                    .catch(reject)
            })
        }

        return super.setDataToStorage(key, value, storageType)
    }

    deleteDataFromStorage(key, storageType) {
        if (storageType === STORAGE_TYPE.PLATFORM_INTERNAL) {
            return new Promise((resolve, reject) => {
                const data = {}
                if (Array.isArray(key)) {
                    for (let i = 0; i < key.length; i++) {
                        data[key[i]] = null
                    }
                } else {
                    data[key] = null
                }

                this._platformSdk.player.setDataAsync(data)
                    .then(resolve)
                    .catch(reject)
            })
        }

        return super.deleteDataFromStorage(key, storageType)
    }

    // advertisement
    showBanner(position, placement) {
        this._platformSdk.loadBannerAdAsync(placement, position)
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner() {
        this._platformSdk.hideBannerAdAsync()
            .then(() => {
                this._setBannerState(BANNER_STATE.HIDDEN)
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    preloadInterstitial(placement) {
        this.#preloadInterstitial(placement)
    }

    showInterstitial(placement) {
        this.#preloadInterstitial(placement)
            .then((preloadedInterstitial) => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                return preloadedInterstitial.showAsync()
            })
            .then(() => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                this.#preloadInterstitial(placement, true)
            })
            .catch(() => this._advertisementShowErrorPopup(false))
    }

    preloadRewarded(placement) {
        this.#preloadRewarded(placement)
    }

    showRewarded(placement) {
        this.#preloadRewarded(placement)
            .then((preloadedRewarded) => {
                this._setRewardedState(REWARDED_STATE.OPENED)
                return preloadedRewarded.showAsync()
            })
            .then(() => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
                this._setRewardedState(REWARDED_STATE.CLOSED)
                this.#preloadRewarded(placement, true)
            })
            .catch(() => this._advertisementShowErrorPopup(true))
    }

    // leaderboards
    leaderboardsSetScore(id, score) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)

            const numericScore = typeof score === 'number' ? score : parseInt(score, 10)
            this._platformSdk.globalLeaderboards.setScoreAsync(id, numericScore)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SET_SCORE, error)
                })
        }

        return promiseDecorator.promise
    }

    leaderboardsShowNativePopup(id) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)

            const loadingOverlay = createLoadingOverlay()
            document.body.appendChild(loadingOverlay)

            this._platformSdk.globalLeaderboards.getTopEntriesAsync(id, 20).then((entries) => {
                const players = entries.map((entry) => ({
                    score: entry.getScore(),
                    sessionID: entry.getPlayer().getSessionID(),
                }))

                const overlay = this._platformSdk.overlayViews.createOverlayViewWithXMLString(
                    LEADERBOARD_XML,
                    '',
                    { players },
                    (overlayView) => {
                        overlayView.showAsync()
                        this._overlay = overlayView
                        loadingOverlay.remove()

                        this._resolvePromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP)
                    },
                    (_, error) => {
                        loadingOverlay.remove()
                        this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP, error)
                    },
                )

                const { iframeElement } = overlay

                iframeElement.style.zIndex = 9999
                iframeElement.style.position = 'absolute'
                iframeElement.style.top = 0
                iframeElement.style.left = 0
                iframeElement.style.height = '100vh'
                iframeElement.style.width = '100vw'
                iframeElement.style.border = 0
                iframeElement.id = iframeElement.name

                document.body.appendChild(iframeElement)
            })
                .catch((error) => {
                    loadingOverlay.remove()
                    this._rejectPromiseDecorator(ACTION_NAME.LEADERBOARDS_SHOW_NATIVE_POPUP, error)
                })
        }

        return promiseDecorator.promise
    }

    // payments
    paymentsPurchase(id) {
        let product = this._paymentsGetProductPlatformData(id)
        if (!product) {
            product = { id }
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.PURCHASE)

            this._platformSdk.payments.purchaseAsync({ productID: product.platformProductId })
                .then((purchase) => {
                    const mergedPurchase = { id, ...purchase }
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
        const purchaseIndex = this._paymentsPurchases.findIndex((p) => p.id === id)
        if (purchaseIndex < 0) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.CONSUME_PURCHASE)

            this._platformSdk.payments.consumePurchaseAsync(this._paymentsPurchases[purchaseIndex].purchaseToken)
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
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            this._platformSdk.payments.getCatalogAsync()
                .then((facebookProducts) => {
                    const mergedProducts = products.map((product) => {
                        const facebookProduct = facebookProducts.find((p) => p.productID === product.platformProductId)

                        return {
                            id: product.id,
                            title: facebookProduct.title,
                            description: facebookProduct.description,
                            imageURI: facebookProduct.imageURI,
                            price: facebookProduct.price,
                            priceCurrencyCode: facebookProduct.priceCurrencyCode,
                            priceValue: facebookProduct.priceAmount,
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
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_PURCHASES)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_PURCHASES)

            this._platformSdk.payments.getPurchasesAsync()
                .then((purchases) => {
                    const products = this._paymentsGetProductsPlatformData()

                    this._paymentsPurchases = purchases.map((purchase) => {
                        const product = products.find((p) => p.id === purchase.productID)
                        const mergedPurchase = {
                            id: product.id,
                            ...purchase,
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

    // social
    inviteFriends(options = {}) {
        if (!options.image || !options.text) {
            return Promise.reject()
        }

        if (!isBase64Image(options.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INVITE_FRIENDS)

            this._platformSdk.inviteAsync(options)
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.INVITE_FRIENDS)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.INVITE_FRIENDS, error)
                })
        }

        return promiseDecorator.promise
    }

    joinCommunity(options) {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY)

            if (options && options.isPage === true) {
                this._platformSdk.community.followOfficialPageAsync()
                    .then((res) => this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, res))
                    .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, err))
            } else {
                this._platformSdk.community.joinOfficialGroupAsync()
                    .then((res) => this._resolvePromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, res))
                    .catch((err) => this._rejectPromiseDecorator(ACTION_NAME.JOIN_COMMUNITY, err))
            }
        }

        return promiseDecorator.promise
    }

    share(options) {
        if (!options.image || !options.text) {
            return Promise.reject()
        }

        if (!isBase64Image(options.image)) {
            return Promise.reject(new Error('Image is not base64'))
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.SHARE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.SHARE)

            this._platformSdk.shareAsync({
                intent: 'REQUEST',
                ...options,
            })
                .then(() => {
                    this._resolvePromiseDecorator(ACTION_NAME.SHARE)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(ACTION_NAME.SHARE, error)
                })
        }

        return promiseDecorator.promise
    }

    #setupLeaderboards() {
        const self = this
        self._platformSdk.overlayViews.setCustomEventHandler((event) => {
            if (event === 'leaderboard') {
                self.#leaderboardClicked = true
            } else if (event === 'close') {
                if (self.#leaderboardClicked) {
                    self.#leaderboardClicked = false
                    return
                }

                if (self._overlay) {
                    document.body.removeChild(
                        document.getElementById(self._overlay.iframeElement.id),
                    )

                    self._overlay.dismissAsync()
                    self._overlay = null
                }
            }
        })
    }

    #preloadInterstitial(placementId, forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedInterstitialPromises[placementId]) {
            return this._preloadedInterstitialPromises[placementId]
        }

        let preloadedInterstitial = null

        this._preloadedInterstitialPromises[placementId] = this._platformSdk.getInterstitialAdAsync(placementId)
            .then((interstitial) => {
                preloadedInterstitial = interstitial
                return interstitial.loadAsync()
            })
            .then(() => preloadedInterstitial)
            .catch(() => {
                this._preloadedInterstitialPromises[placementId] = null
                return Promise.reject()
            })

        return this._preloadedInterstitialPromises[placementId]
    }

    #preloadRewarded(placementId, forciblyPreload = false) {
        if (!forciblyPreload && this._preloadedRewardedPromises[placementId]) {
            return this._preloadedRewardedPromises[placementId]
        }

        let preloadedRewarded = null

        this._preloadedRewardedPromises[placementId] = this._platformSdk.getRewardedVideoAsync(placementId)
            .then((rewarded) => {
                preloadedRewarded = rewarded
                return rewarded.loadAsync()
            })
            .then(() => preloadedRewarded)
            .catch(() => {
                this._preloadedRewardedPromises[placementId] = null
                return Promise.reject()
            })

        return this._preloadedRewardedPromises[placementId]
    }

    async #subscribeBotAsync() {
        try {
            const isSubscribed = await this._platformSdk.player.isSubscribedBotAsync()
            if (isSubscribed) {
                return Promise.resolve()
            }
        } catch (e) {
            if (e?.code === 'INVALID_OPERATION') {
                // web-messenger platform
            } else {
                throw new Error(e)
            }
        }

        let canSubscribe = false

        try {
            canSubscribe = await this._platformSdk.player.canSubscribeBotAsync()
            if (canSubscribe) {
                return this._platformSdk.player.subscribeBotAsync()
            }
        } catch (e) {
            if (e?.code === 'INVALID_OPERATION') {
                return Promise.resolve()
            }

            throw new Error(e)
        }

        return Promise.resolve()
    }
}

export default FacebookPlatformBridge
