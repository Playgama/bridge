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
import { addJavaScript, waitFor } from '../utils'
import { ACTION_NAME } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import { DEVICE_TYPE, type DeviceType } from '../modules/device/constants'
import {
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
} from '../modules/advertisement/constants'
import type { AnyRecord } from '../utils'

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js'

interface VkStorageGetResponse {
    keys: Array<{ key: string; value: string }>
}

interface VkBridge {
    send(method: string, params?: AnyRecord): Promise<AnyRecord>
}

declare global {
    interface Window {
        vkBridge?: VkBridge
    }
}

class VkPlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.VK
    }

    get platformLanguage(): string {
        const url = new URL(window.location.href)
        if (url.searchParams.has('language')) {
            const languageString = url.searchParams.get('language')
            let languageCode = 0
            try { languageCode = parseInt(languageString as string, 10) } catch (e) {
                languageCode = 0
            }

            switch (languageCode) {
                case 0: {
                    return 'ru'
                }
                case 1: {
                    return 'uk'
                }
                case 2: {
                    return 'be'
                }
                case 3: {
                    return 'en'
                }
                default: {
                    return 'ru'
                }
            }
        }

        return super.platformLanguage
    }

    get platformPayload(): string | null {
        const url = new URL(window.location.href)
        if (url.searchParams.has('hash')) {
            return url.searchParams.get('hash')
        }

        return super.platformPayload
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 30
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // device
    get deviceType(): DeviceType {
        switch (this.#platform) {
            case 'html5_ios':
            case 'html5_android':
            case 'html5_mobile': {
                return DEVICE_TYPE.MOBILE
            }
            case 'web': {
                return DEVICE_TYPE.DESKTOP
            }
            default: {
                return super.deviceType
            }
        }
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    get isPlayerAuthorized(): boolean {
        return this._isPlayerAuthorized
    }

    // social
    get isInviteFriendsSupported(): boolean {
        return true
    }

    get isJoinCommunitySupported(): boolean {
        return true
    }

    get isShareSupported(): boolean {
        return true
    }

    get isAddToHomeScreenSupported(): boolean {
        return this.#platform === 'html5_android'
    }

    get isAddToFavoritesSupported(): boolean {
        return true
    }

    // payments
    get isPaymentsSupported(): boolean {
        return true
    }

    protected _isBannerSupported = true

    #platform: string | null = null

    // Кэш членства в сообществах (groupId → boolean). Прогревается при инициализации,
    // чтобы при клике открыть страницу сообщества СИНХРОННО (мобильный WebView блокирует
    // открытие после await).
    #communityMembership = new Map<number, boolean>()

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            const url = new URL(window.location.href)
            if (url.searchParams.has('platform')) {
                this.#platform = url.searchParams.get('platform')
            }

            addJavaScript(SDK_URL).then(() => {
                waitFor('vkBridge').then(() => {
                    this._platformSdk = window.vkBridge as VkBridge;
                    (this._platformSdk as VkBridge)
                        .send('VKWebAppInit')
                        .then(() => {
                            const userInfoPromise = (this._platformSdk as VkBridge).send('VKWebAppGetUserInfo')
                                .then((data) => {
                                    if (data) {
                                        this._playerId = data.id as string
                                        this._playerName = `${data.first_name} ${data.last_name}`

                                        if (data.photo_100) {
                                            this._playerPhotos.push(data.photo_100 as string)
                                        }

                                        if (data.photo_200) {
                                            this._playerPhotos.push(data.photo_200 as string)
                                        }

                                        if (data.photo_max_orig) {
                                            this._playerPhotos.push(data.photo_max_orig as string)
                                        }
                                    }
                                })

                            // Explicitly validate the VK session via VKWebAppGetAuthToken —
                            // isPlayerAuthorized must reflect the real auth state, not assume true.
                            const authPromise = this._reAuth()

                            Promise.allSettled([userInfoPromise, authPromise])
                                .finally(() => {
                                    this._isInitialized = true
                                    this._setPlatformStorageAvailable(true)
                                    this._prefetchCommunityMembership()
                                    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                })
                        })
                })
            })
        }

        return promiseDecorator.promise
    }

    // player
    // Rejects when the session could not be validated, like every other platform
    // bridge does. _reAuth() resolves a boolean because storage retries need the
    // flag rather than an exception; resolving that boolean here made a refused
    // token look like a successful login to any caller that only awaits the
    // promise — the Unity glue reports OnAuthorizeCompleted 'true' on exactly
    // this path.
    authorizePlayer(): Promise<unknown> {
        return this._reAuth().then((authorized) => {
            if (!authorized) {
                throw new Error('VK declined the authorization request')
            }

            return authorized
        })
    }

    // storage — VK stores values per key. Each operation retries once after a re-auth,
    // since a stale VK session sometimes rejects storage calls until it is re-validated.
    getDataFromStorage(keys: string[]): Promise<Record<string, unknown>> {
        return this._storageWithAuthRetry(async () => {
            const sdk = this._platformSdk as VkBridge
            const valuesResult = await sdk.send('VKWebAppStorageGet', { keys }) as unknown as VkStorageGetResponse
            const data: Record<string, unknown> = {}
            valuesResult.keys.forEach((entry) => {
                if (entry.value !== '') {
                    data[entry.key] = entry.value
                }
            })
            return data
        })
    }

    setDataToStorage(data: Record<string, unknown>): Promise<void> {
        return this._storageWithAuthRetry(() => {
            const sdk = this._platformSdk as VkBridge
            return Promise.all(
                Object.keys(data).map((key) => sdk.send('VKWebAppStorageSet', {
                    key,
                    value: data[key] as string,
                })),
            ).then(() => undefined)
        })
    }

    deleteDataFromStorage(keys: string[]): Promise<void> {
        return this._storageWithAuthRetry(() => {
            const sdk = this._platformSdk as VkBridge
            return Promise.all(
                keys.map((key) => sdk.send('VKWebAppStorageSet', {
                    key,
                    value: '',
                })),
            ).then(() => undefined)
        })
    }

    // advertisement
    showBanner(position?: unknown): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppShowBannerAd', { banner_location: position })
            .then((data) => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.SHOWN)
                } else {
                    this._setBannerState(BANNER_STATE.FAILED)
                }
            })
            .catch(() => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppHideBannerAd')
            .then((data) => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.HIDDEN)
                }
            })
    }

    showInterstitial(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' })
            .then((data) => {
                if (data.result) {
                    this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
                }
            })
            .finally(() => {
                (this._platformSdk as VkBridge)
                    .send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
                    .then((data) => {
                        if (data.result) {
                            this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
                        } else {
                            this._showAdFailurePopup(false)
                        }
                    })
                    .catch(() => {
                        this._showAdFailurePopup(false)
                    })
            })
    }

    showRewarded(): void {
        (this._platformSdk as VkBridge)
            .send('VKWebAppCheckNativeAds', { ad_format: 'reward', use_waterfall: true })
            .then((data) => {
                if (data.result) {
                    this._setRewardedState(REWARDED_STATE.OPENED)
                }
            })
            .finally(() => {
                (this._platformSdk as VkBridge)
                    .send('VKWebAppShowNativeAds', { ad_format: 'reward', use_waterfall: true })
                    .then((data) => {
                        if (data.result) {
                            this._setRewardedState(REWARDED_STATE.REWARDED)
                            this._setRewardedState(REWARDED_STATE.CLOSED)
                        } else {
                            this._showAdFailurePopup(true)
                        }
                    })
                    .catch(() => {
                        this._showAdFailurePopup(true)
                    })
            })
    }

    // social
    inviteFriends(): Promise<unknown> {
        return this._sendRequestToVKBridge(ACTION_NAME.INVITE_FRIENDS, 'VKWebAppShowInviteBox', { }, 'success')
    }

    joinCommunity(options?: AnyRecord & { groupId?: string | number }): Promise<unknown> {
        // VKWebAppJoinGroup требует именно integer (иначе client_error code 5
        // "Param group_id should be a number")
        const groupId = this._resolveCommunityGroupId(options)
        if (!groupId) {
            return Promise.reject(new Error('joinCommunity: invalid groupId'))
        }

        // Если заранее (из прогретого кэша) знаем, что пользователь уже в группе — диалог
        // вступления ничего не покажет, поэтому открываем страницу сообщества. Делаем это
        // СИНХРОННО, в рамках клика: мобильный WebView блокирует открытие после await.
        if (this.#communityMembership.get(groupId) === true) {
            this._openCommunityPage(groupId)
            return Promise.resolve({ result: true, alreadyMember: true })
        }

        // Членство неизвестно или пользователь не в группе — показываем нативный диалог.
        // VKWebAppJoinGroup при уже-членстве просто резолвится без диалога.
        return (this._platformSdk as VkBridge)
            .send('VKWebAppJoinGroup', { group_id: groupId })
            .then((data) => {
                this.#communityMembership.set(groupId, true)
                return data
            })
    }

    isMemberOfCommunity(options?: AnyRecord & { groupId?: string | number }): Promise<boolean> {
        const groupId = this._resolveCommunityGroupId(options)
        if (!groupId) {
            return Promise.reject(new Error('isMemberOfCommunity: invalid groupId'))
        }

        // VKWebAppGetGroupInfo отдаёт is_member: 1 — состоит, 0 — нет.
        // Поле отсутствует у закрытых сообществ → трактуем как false.
        return (this._platformSdk as VkBridge)
            .send('VKWebAppGetGroupInfo', { group_id: groupId })
            .then((data) => {
                const isMember = data?.is_member === 1
                this.#communityMembership.set(groupId, isMember)
                return isMember
            })
    }

    share(options?: AnyRecord & { url?: string, link?: string }): Promise<unknown> {
        const { url, link, ...rest } = options ?? {}
        const parameters: AnyRecord = { ...rest }
        if (url || link) {
            parameters.link = url ?? link
        }

        return this._sendRequestToVKBridge(ACTION_NAME.SHARE, 'VKWebAppShare', parameters, 'type')
    }

    addToHomeScreen(): Promise<unknown> {
        return this._sendRequestToVKBridge(ACTION_NAME.ADD_TO_HOME_SCREEN, 'VKWebAppAddToHomeScreen')
    }

    addToFavorites(): Promise<unknown> {
        return this._sendRequestToVKBridge(ACTION_NAME.ADD_TO_FAVORITES, 'VKWebAppAddToFavorites')
    }

    // clipboard
    clipboardWrite(text: string): Promise<void> {
        return this._sendRequestToVKBridge(ACTION_NAME.CLIPBOARD_WRITE, 'VKWebAppCopyText', { text })
            .then(() => undefined)
    }

    // payments — orders go through the native VK order box; the catalog is served
    // by the fork's external storage service keyed by the app id.
    paymentsPurchase(id: string): Promise<unknown> {
        const product = this._paymentsGetProductPlatformData(id)
        let platformProductId: string | number = (product?.id as string | number) ?? id

        if (typeof platformProductId === 'number') {
            platformProductId = platformProductId.toString()
        }

        return this._sendRequestToVKBridge(
            ACTION_NAME.PURCHASE,
            'VKWebAppShowOrderBox',
            { type: 'item', item: platformProductId },
            'order_id',
        ).then((data) => {
            const purchase = { id, ...(data as AnyRecord ?? {}) }
            this._paymentsPurchases.push(purchase)
            return purchase
        })
    }

    paymentsGetPurchases(): Promise<unknown> {
        return Promise.resolve(this._paymentsPurchases)
    }

    paymentsGetCatalog(): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.GET_CATALOG)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.GET_CATALOG)

            const url = new URL(window.location.href)
            const appId = url.searchParams.get('vk_app_id') || url.searchParams.get('api_id')

            if (appId) {
                this._fetchExternalCatalog('vk', appId)
                    .then((products) => {
                        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, products)
                    })
                    .catch(() => {
                        this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, this._paymentsGetProductsPlatformData())
                    })
            } else {
                this._resolvePromiseDecorator(ACTION_NAME.GET_CATALOG, this._paymentsGetProductsPlatformData())
            }
        }

        return promiseDecorator.promise
    }

    // The app id VKWebAppGetAuthToken is asked for. Overridable: Odnoklassniki
    // launches the mini-app with a different query parameter, and without an id
    // the token call is skipped and the player never counts as authorized.
    protected _getAuthAppId(): string | null {
        const url = new URL(window.location.href)
        return url.searchParams.get('vk_app_id') || url.searchParams.get('api_id')
    }

    // Re-runs VKWebAppGetAuthToken. Used on initialize and when a storage call fails —
    // sometimes the VK session needs to be re-validated (esp. vk_is_app_user=0 contexts).
    protected _reAuth(): Promise<boolean> {
        if (!this._platformSdk) {
            return Promise.resolve(false)
        }

        const appIdRaw = this._getAuthAppId()
        const appId = appIdRaw ? parseInt(appIdRaw, 10) : null
        if (!appId) {
            this._isPlayerAuthorized = false
            return Promise.resolve(false)
        }

        return (this._platformSdk as VkBridge).send('VKWebAppGetAuthToken', { app_id: appId, scope: '' })
            .then((data) => {
                const ok = Boolean(data && data.user_id)
                this._isPlayerAuthorized = ok
                return ok
            })
            .catch(() => {
                this._isPlayerAuthorized = false
                return false
            })
    }

    // Wraps a storage operation: on first failure, re-runs auth and retries once.
    protected _storageWithAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
        return operation().catch(() => this._reAuth().then(() => operation()))
    }

    protected _fetchExternalCatalog(platformKey: string, appId: string): Promise<AnyRecord[]> {
        return fetch(`https://storage.choclategames.ru/api/items/${platformKey}/${appId}/`)
            .then((response) => response.json())
            .then((data) => {
                const items = data && Array.isArray(data.items) ? data.items as AnyRecord[] : []
                return items.map((item) => ({
                    id: item.item_id,
                    title: item.title,
                    price: item.price,
                    description: '',
                    imageURI: '',
                    priceCurrencyCode: '',
                    priceValue: parseInt(item.price as string, 10) || 0,
                }))
            })
    }

    protected get _defaultJoinCommunityGroupId(): number {
        return 213542253
    }

    protected _resolveCommunityGroupId(options?: AnyRecord & { groupId?: string | number }): number | null {
        // Достаём числовой ID из любой обёртки: число, строка, { groupId } или
        // { vk } / { ok } — на любой глубине вложенности.
        const extractGroupId = (value: unknown): unknown => {
            if (value === null || value === undefined) {
                return null
            }
            if (typeof value === 'object') {
                const record = value as AnyRecord
                return extractGroupId(record.groupId ?? record[this.platformId])
            }
            return value
        }

        const configGroupId = (this._options?.social as AnyRecord | undefined)
            ?.joinCommunity as AnyRecord | undefined

        // ID берётся из конфига (если задан), иначе — из аргумента, иначе хардкод-дефолт.
        // || (не ??): пустая строка из конфига и null проваливаются на дефолт,
        // а валидный group id всегда положительный (0/'' невозможны).
        const rawGroupId = extractGroupId(configGroupId?.[this.platformId])
            || extractGroupId(options)
            || this._defaultJoinCommunityGroupId

        const groupId = Number(rawGroupId)
        return Number.isFinite(groupId) && groupId > 0 ? groupId : null
    }

    protected _getCommunityUrl(groupId: number): string {
        return `https://vk.com/club${groupId}`
    }

    protected _openCommunityPage(groupId: number): void {
        // Открываем через клик по временному <a target="_blank">, а не window.open:
        // в Android-приложении VK голый window.open навигирует фрейм самой игры.
        const link = document.createElement('a')
        link.href = this._getCommunityUrl(groupId)
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        link.remove()
    }

    protected _prefetchCommunityMembership(): void {
        const groupId = this._resolveCommunityGroupId()
        if (!groupId || !this._platformSdk) {
            return
        }

        (this._platformSdk as VkBridge)
            .send('VKWebAppGetGroupInfo', { group_id: groupId })
            .then((data) => {
                this.#communityMembership.set(groupId, data?.is_member === 1)
            })
            .catch(() => {})
    }

    protected _sendRequestToVKBridge(actionName: string, vkMethodName: string, parameters: AnyRecord = { }, responseSuccessKey = 'result'): Promise<unknown> {
        let promiseDecorator = this._getPromiseDecorator(actionName)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(actionName);
            (this._platformSdk as VkBridge)
                .send(vkMethodName, parameters)
                .then((data) => {
                    if (data[responseSuccessKey]) {
                        this._resolvePromiseDecorator(actionName, data)
                        return
                    }

                    this._rejectPromiseDecorator(actionName)
                })
                .catch((error) => {
                    this._rejectPromiseDecorator(actionName, error)
                })
        }

        return promiseDecorator.promise
    }
}

export default VkPlatformBridge
