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
import { ACTION_NAME, ERROR } from '../constants'
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import {
    ADVANCED_BANNER_CONTAINER_ID_PREFIX,
    BANNER_CONTAINER_ID,
    BANNER_STATE,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    type BannerPosition,
} from '../modules/advertisement/constants'
import {
    createAdvertisementBannerContainer,
    createAdvancedBannerContainers,
    removeAdvancedBannerContainers,
    type AdvancedBannerConfig,
} from '../modules/advertisement'
import { LEADERBOARD_TYPE, type LeaderboardType } from '../modules/leaderboards/constants'
import {
    findAchievementGameId,
    type AchievementMapping,
    type NormalizedAchievement,
} from '../modules/achievements'

const SDK_URL = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js'
const USERDATA_KEY = 'userData'
const INTERSTITIAL_TYPES = ['start', 'pause', 'next', 'browse']
const DEFAULT_INTERSTITIAL_TYPE = 'next'
const DEFAULT_REWARDED_NAME = 'reward'
// Banner sizes supported by Y8, largest area first
const BANNER_SIZES = [
    { width: 300, height: 250 },
    { width: 728, height: 90 },
    { width: 320, height: 100 },
    { width: 468, height: 60 },
    { width: 320, height: 50 },
]
const ANALYTICS_MAX_AMOUNT = 100

interface Y8User {
    pid?: string
    nickname?: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    first_name?: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    last_name?: string
    avatars?: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        thumb_url?: string
        // eslint-disable-next-line @typescript-eslint/naming-convention
        medium_url?: string
        // eslint-disable-next-line @typescript-eslint/naming-convention
        large_url?: string
    }
}

interface Y8AdBreakInfo {
    breakStatus: string
}

interface Y8ShowAdOptions {
    type: string
    name: string
    beforeAd?: () => void
    afterAd?: () => void
    adBreakDone?: (info: Y8AdBreakInfo) => void
    beforeReward?: (showAdFn: () => void) => void
    adDismissed?: () => void
    adViewed?: () => void
}

interface Y8Sdk {
    init(appConfig: AnyRecord, adConfig?: AnyRecord): Promise<void>
    onAuth(callback: (user: Y8User | null, error: unknown) => void): void
    login(): Promise<void>
    getUser(): Y8User | null
    getPlatformLocale(): Promise<string>
    showAd(options: Y8ShowAdOptions): Promise<void>
    requestBanner(options: { id: string; width: number; height: number }): Promise<void>
    clearBanner(id: string): void
    saveLeaderboardScore(options: { table: string; points: number }): Promise<void>
    getLeaderboardScores(options: { table: string; mode?: string }): Promise<{ items: AnyRecord[] }>
    getAchievements(): Promise<AnyRecord[]>
    awardAchievement(options: { achievement: string; achievementKey: string }): Promise<void>
    saveData(options: { key: string; value: string }): Promise<void>
    loadData(options: { key: string }): Promise<string | null>
    trackCustomEvent(name: string, value?: number | null, amount?: number): void
}

declare global {
    interface Window {
        y8?: {
            sdk(): Y8Sdk
        }
    }
}

class Y8PlatformBridge extends PlatformBridgeBase {
    // platform
    get platformId(): PlatformId {
        return PLATFORM_ID.Y8
    }

    get platformLanguage(): string {
        return this.#platformLanguage ?? super.platformLanguage
    }

    // advertisement
    get isInterstitialSupported(): boolean {
        return true
    }

    get initialInterstitialDelay(): number {
        return 180
    }

    get isRewardedSupported(): boolean {
        return true
    }

    // social
    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    // player
    get isPlayerAuthorizationSupported(): boolean {
        return true
    }

    // leaderboards
    get leaderboardsType(): LeaderboardType {
        return LEADERBOARD_TYPE.IN_GAME
    }

    // achievements
    get isAchievementsSupported(): boolean {
        return true
    }

    protected _isBannerSupported = true

    protected _isAdvancedBannersSupported = true

    #platformLanguage: string | null = null

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            // Same names as in the Y8 SDK: appId for appConfig, gameId for adConfig
            const { appId, gameId } = (this._options ?? {}) as { appId?: string; gameId?: string }

            if (!appId || !gameId) {
                this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, ERROR.GAME_PARAMS_NOT_FOUND)
            } else {
                addJavaScript(SDK_URL)
                    .then(() => waitFor('y8', 'sdk'))
                    .then(async () => {
                        const sdk = (window.y8 as { sdk(): Y8Sdk }).sdk()
                        this._platformSdk = sdk

                        sdk.onAuth((user) => this.#updatePlayerInfo(user))

                        // init resolves after the auto login attempt, so the player state is known
                        await sdk.init(
                            { appId, autoLogin: true },
                            { gameId, preloadAdBreaks: 'on', sound: 'on' },
                        )

                        this.#platformLanguage = await sdk.getPlatformLocale().catch(() => null)

                        this._isInitialized = true
                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
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

        // login() must run synchronously inside the user gesture, otherwise the popup is blocked
        return (this._platformSdk as Y8Sdk).login()
            .then(() => {
                if (!this._isPlayerAuthorized) {
                    throw new Error('Y8 login failed')
                }
            })
    }

    // storage
    async getDataFromStorage(): Promise<Record<string, unknown>> {
        this.#ensurePlayerAuthorized()

        const value = await (this._platformSdk as Y8Sdk).loadData({ key: USERDATA_KEY })
        if (!value) {
            return {}
        }

        try {
            return JSON.parse(value)
        } catch {
            return {}
        }
    }

    async setDataToStorage(data: Record<string, unknown>): Promise<void> {
        const snapshot = await this.getDataFromStorage()
        Object.keys(data).forEach((key) => { snapshot[key] = data[key] })
        await this.#submitSnapshot(snapshot)
    }

    async deleteDataFromStorage(keys: string[]): Promise<void> {
        const snapshot = await this.getDataFromStorage()
        keys.forEach((key) => { delete snapshot[key] })
        await this.#submitSnapshot(snapshot)
    }

    // advertisement
    showBanner(position?: unknown): void {
        const container = document.getElementById(BANNER_CONTAINER_ID)
            ?? createAdvertisementBannerContainer(position as BannerPosition)

        container.style.display = 'block'

        this._setBannerState(BANNER_STATE.LOADING)
        this.#requestBanner(container)
            .then(() => {
                this._setBannerState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                container.style.display = 'none'
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }

    hideBanner(): void {
        const container = document.getElementById(BANNER_CONTAINER_ID)
        if (container) {
            container.style.display = 'none'
        }

        (this._platformSdk as Y8Sdk | null)?.clearBanner(BANNER_CONTAINER_ID)
        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    showAdvancedBanners(banners?: unknown): void {
        this._setAdvancedBannersState(BANNER_STATE.LOADING)

        this.#clearAdvancedBanners()
        const containerIds = createAdvancedBannerContainers((banners as AdvancedBannerConfig[] | undefined) ?? [])
        const requests = containerIds.map((id) => this.#requestBanner(document.getElementById(id) as HTMLElement))

        Promise.all(requests)
            .then(() => {
                this._setAdvancedBannersState(BANNER_STATE.SHOWN)
            })
            .catch(() => {
                this.#clearAdvancedBanners()
                this._setAdvancedBannersState(BANNER_STATE.FAILED)
            })
    }

    hideAdvancedBanners(): void {
        this.#clearAdvancedBanners()
        this._setAdvancedBannersState(BANNER_STATE.HIDDEN)
    }

    showInterstitial(placement?: unknown): void {
        const type = typeof placement === 'string' && INTERSTITIAL_TYPES.includes(placement)
            ? placement
            : DEFAULT_INTERSTITIAL_TYPE
        let isOpened = false

        // Y8 skips breaks inside its own frequency window and reports them only via adBreakDone
        const onNotShown = (breakStatus?: string) => {
            if (breakStatus === 'frequencyCapped') {
                this._setInterstitialState(INTERSTITIAL_STATE.FAILED)
            } else {
                this._showAdFailurePopup(false)
            }
        }

        (this._platformSdk as Y8Sdk).showAd({
            type,
            name: typeof placement === 'string' && placement ? placement : type,
            beforeAd: () => {
                isOpened = true
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            },
            adBreakDone: ({ breakStatus }) => {
                if (!isOpened) {
                    onNotShown(breakStatus)
                }
            },
        }).catch(() => {
            if (!isOpened) {
                onNotShown()
            }
        })
    }

    showRewarded(placement?: unknown): void {
        let isOpened = false;

        (this._platformSdk as Y8Sdk).showAd({
            type: 'reward',
            name: typeof placement === 'string' && placement ? placement : DEFAULT_REWARDED_NAME,
            beforeAd: () => {
                isOpened = true
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            },
            beforeReward: (showAdFn) => { showAdFn() },
            adViewed: () => { this._setRewardedState(REWARDED_STATE.REWARDED) },
            adBreakDone: () => {
                if (!isOpened) {
                    this._showAdFailurePopup(true)
                }
            },
        }).catch(() => {
            if (!isOpened) {
                this._showAdFailurePopup(true)
            }
        })
    }

    // leaderboards
    leaderboardsSetScore(id: string, score: number): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        return (this._platformSdk as Y8Sdk).saveLeaderboardScore({ table: id, points: score })
    }

    leaderboardsGetEntries(id: string): Promise<unknown> {
        return (this._platformSdk as Y8Sdk).getLeaderboardScores({ table: id, mode: 'alltime' })
            .then(({ items }) => items.map((entry) => ({
                id: entry.playerid,
                name: entry.playername,
                score: entry.points,
                rank: entry.rank,
                photo: null,
            })))
    }

    // achievements
    achievementsUnlock(data?: unknown): Promise<unknown> {
        if (!this._isPlayerAuthorized) {
            return Promise.reject()
        }

        // Y8 needs an object mapping in the config: { achievement, achievementkey }
        const options = data as AnyRecord | null | undefined
        const achievementKey = options?.achievementKey ?? options?.achievementkey
        if (!options || typeof options !== 'object' || !options.achievement || !achievementKey) {
            return Promise.reject()
        }

        return (this._platformSdk as Y8Sdk).awardAchievement({
            achievement: options.achievement as string,
            achievementKey: achievementKey as string,
        })
    }

    achievementsGetList(): Promise<NormalizedAchievement[]> {
        return (this._platformSdk as Y8Sdk).getAchievements()
            .then((items) => {
                const achievements = this._options.achievements as AchievementMapping[] | undefined

                // getAchievements returns every achievement configured for the app;
                // for a logged-in player the unlocked ones are marked with `awarded` / `player`
                return items.map((item) => {
                    const gameId = findAchievementGameId(
                        achievements,
                        PLATFORM_ID.Y8,
                        (platformData) => (platformData.achievementKey ?? platformData.achievementkey)
                            === item.achievementkey,
                    )

                    return {
                        id: gameId ?? item.achievementkey as string,
                        name: typeof item.achievement === 'string' ? item.achievement : undefined,
                        description: typeof item.description === 'string' ? item.description : undefined,
                        unlocked: item.awarded === true || !!item.player,
                    }
                })
            })
    }

    // analytics
    sendAnalyticsEvent(eventName: string, data: Record<string, unknown>): void {
        const { value, amount } = data
        const sdk = this._platformSdk as Y8Sdk | null
        sdk?.trackCustomEvent(
            eventName,
            typeof value === 'number' ? value : null,
            typeof amount === 'number' ? Math.min(amount, ANALYTICS_MAX_AMOUNT) : undefined,
        )
    }

    // Picks the largest Y8 banner size that fits into the container
    #requestBanner(container: HTMLElement): Promise<void> {
        const size = BANNER_SIZES.find(({ width, height }) => width <= container.clientWidth
            && height <= container.clientHeight)

        if (!size) {
            return Promise.reject(new Error('Banner container is too small'))
        }

        return (this._platformSdk as Y8Sdk).requestBanner({ id: container.id, ...size })
    }

    #clearAdvancedBanners(): void {
        const containers = document.querySelectorAll(`[id^="${ADVANCED_BANNER_CONTAINER_ID_PREFIX}"]`)
        containers.forEach((container) => (this._platformSdk as Y8Sdk | null)?.clearBanner(container.id))
        removeAdvancedBannerContainers()
    }

    #ensurePlayerAuthorized(): void {
        if (!this._isPlayerAuthorized) {
            throw new Error('Player is not authorized')
        }
    }

    #submitSnapshot(snapshot: Record<string, unknown>): Promise<void> {
        return (this._platformSdk as Y8Sdk).saveData({ key: USERDATA_KEY, value: JSON.stringify(snapshot) })
    }

    #updatePlayerInfo(user: Y8User | null): void {
        if (!user) {
            return
        }

        this._isPlayerAuthorized = true
        this._setPlatformStorageAvailable(true)

        const {
            pid, nickname, first_name: firstName, last_name: lastName, avatars,
        } = user

        this._playerId = pid ?? null
        this._playerName = [firstName, lastName].filter((x) => !!x).join(' ') || nickname || null
        this._playerPhotos = [avatars?.thumb_url, avatars?.medium_url, avatars?.large_url]
            .filter((url): url is string => !!url)
    }
}

export default Y8PlatformBridge
