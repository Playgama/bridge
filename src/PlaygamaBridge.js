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

import {
    PLATFORM_ID,
    MODULE_NAME,
    EVENT_NAME,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    BANNER_STATE,
    STORAGE_TYPE,
    VISIBILITY_STATE,
    DEVICE_TYPE,
    PLATFORM_MESSAGE,
    ERROR,
} from './constants'
import PromiseDecorator from './common/PromiseDecorator'
import PlatformModule from './modules/PlatformModule'
import PlayerModule from './modules/PlayerModule'
import GameModule from './modules/GameModule'
import StorageModule from './modules/StorageModule'
import AdvertisementModule from './modules/AdvertisementModule'
import SocialModule from './modules/SocialModule'
import DeviceModule from './modules/DeviceModule'
import LeaderboardModule from './modules/LeaderboardModule'
import PaymentsModule from './modules/PaymentsModule'
import RemoteConfigModule from './modules/RemoteConfigModule'
import ClipboardModule from './modules/ClipboardModule'
import AchievementsModule from './modules/AchievementsModule'

import PlatformBridgeBase from './platform-bridges/PlatformBridgeBase'
import VkPlatformBridge from './platform-bridges/VkPlatformBridge'
import YandexPlatformBridge from './platform-bridges/YandexPlatformBridge'
import CrazyGamesPlatformBridge from './platform-bridges/CrazyGamesPlatformBridge'
import AbsoluteGamesPlatformBridge from './platform-bridges/AbsoluteGamesPlatformBridge'
import GameDistributionPlatformBridge from './platform-bridges/GameDistributionPlatformBridge'
import OkPlatformBridge from './platform-bridges/OkPlatformBridge'
import PlaygamaPlatformBridge from './platform-bridges/PlaygamaPlatformBridge'
import PlayDeckPlatformBridge from './platform-bridges/PlayDeckPlatformBridge'
import TelegramPlatformBridge from './platform-bridges/TelegramPlatformBridge'
import Y8PlatformBridge from './platform-bridges/Y8PlatformBridge'
import LaggedPlatformBridge from './platform-bridges/LaggedPlatformBridge'
import FacebookPlatformBridge from './platform-bridges/FacebookPlatformBridge'
import QaToolPlatformBridge from './platform-bridges/QaToolPlatformBridge'
import PokiPlatformBridge from './platform-bridges/PokiPlatformBridge'
import MsnPlatformBridge from './platform-bridges/MsnPlatformBridge'
import { deepMerge } from './common/utils'

class PlaygamaBridge {
    get version() {
        return PLUGIN_VERSION
    }

    get isInitialized() {
        return this.#isInitialized
    }

    get options() {
        return this.#platformBridge.options
    }

    get platform() {
        return this.#getModule(MODULE_NAME.PLATFORM)
    }

    get player() {
        return this.#getModule(MODULE_NAME.PLAYER)
    }

    get game() {
        return this.#getModule(MODULE_NAME.GAME)
    }

    get storage() {
        return this.#getModule(MODULE_NAME.STORAGE)
    }

    get advertisement() {
        return this.#getModule(MODULE_NAME.ADVERTISEMENT)
    }

    get social() {
        return this.#getModule(MODULE_NAME.SOCIAL)
    }

    get device() {
        return this.#getModule(MODULE_NAME.DEVICE)
    }

    get leaderboard() {
        return this.#getModule(MODULE_NAME.LEADERBOARD)
    }

    get payments() {
        return this.#getModule(MODULE_NAME.PAYMENTS)
    }

    get achievements() {
        return this.#getModule(MODULE_NAME.ACHIEVEMENTS)
    }

    get remoteConfig() {
        return this.#getModule(MODULE_NAME.REMOTE_CONFIG)
    }

    get clipboard() {
        return this.#getModule(MODULE_NAME.CLIPBOARD)
    }

    get PLATFORM_ID() {
        return PLATFORM_ID
    }

    get PLATFORM_MESSAGE() {
        return PLATFORM_MESSAGE
    }

    get MODULE_NAME() {
        return MODULE_NAME
    }

    get EVENT_NAME() {
        return EVENT_NAME
    }

    get INTERSTITIAL_STATE() {
        return INTERSTITIAL_STATE
    }

    get REWARDED_STATE() {
        return REWARDED_STATE
    }

    get BANNER_STATE() {
        return BANNER_STATE
    }

    get STORAGE_TYPE() {
        return STORAGE_TYPE
    }

    get VISIBILITY_STATE() {
        return VISIBILITY_STATE
    }

    get DEVICE_TYPE() {
        return DEVICE_TYPE
    }

    #isInitialized = false

    #initializationPromiseDecorator = null

    #platformBridge = null

    #modules = {}

    initialize(options) {
        if (this.#isInitialized) {
            return Promise.resolve()
        }

        if (!this.#initializationPromiseDecorator) {
            this.#initializationPromiseDecorator = new PromiseDecorator()

            let configFilePath = './playgama-bridge-config.json'
            if (options && options.configFilePath) {
                configFilePath = options.configFilePath
            }

            let modifiedOptions

            fetch(configFilePath)
                .then((response) => response.json())
                .then((data) => {
                    modifiedOptions = { ...data }
                })
                .catch(() => {
                    modifiedOptions = { ...options }
                })
                .finally(() => {
                    this.#createPlatformBridge(modifiedOptions)

                    this.#modules[MODULE_NAME.PLATFORM] = new PlatformModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.PLAYER] = new PlayerModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.GAME] = new GameModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.STORAGE] = new StorageModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.ADVERTISEMENT] = new AdvertisementModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.SOCIAL] = new SocialModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.DEVICE] = new DeviceModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.LEADERBOARD] = new LeaderboardModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.PAYMENTS] = new PaymentsModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.REMOTE_CONFIG] = new RemoteConfigModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.CLIPBOARD] = new ClipboardModule(this.#platformBridge)
                    this.#modules[MODULE_NAME.ACHIEVEMENTS] = new AchievementsModule(this.#platformBridge)

                    if (!modifiedOptions.disableLoadingLogo) {
                        this.#createProgressLogo()
                    }

                    this.#platformBridge
                        .initialize()
                        .then(() => {
                            this.#isInitialized = true
                            console.info(`%c PlaygamaBridge v.${this.version} initialized. `, 'background: #01A5DA; color: white')

                            if (this.#initializationPromiseDecorator) {
                                this.#initializationPromiseDecorator.resolve()
                                this.#initializationPromiseDecorator = null
                            }

                            if (this.#platformBridge.options?.advertisement?.interstitial?.preloadOnStart) {
                                const placement = this.#platformBridge.options.advertisement.interstitial.preloadOnStart
                                this.#modules[MODULE_NAME.ADVERTISEMENT].preloadInterstitial(placement)
                            }

                            if (this.#platformBridge.options?.advertisement?.rewarded?.preloadOnStart) {
                                const placement = this.#platformBridge.options.advertisement.rewarded.preloadOnStart
                                this.#modules[MODULE_NAME.ADVERTISEMENT].preloadRewarded(placement)
                            }
                        })
                        .finally(() => {
                            if (!modifiedOptions.disableLoadingLogo) {
                                setTimeout(() => {
                                    if (!this._setLoadingProgressCalled) {
                                        this.setLoadingProgress(100)
                                    }
                                }, 700)
                            }
                        })
                })
        }

        return this.#initializationPromiseDecorator.promise
    }

    #createPlatformBridge(options) {
        let platformId = PLATFORM_ID.MOCK

        const url = new URL(window.location.href)

        if (options.forciblySetPlatformId) {
            platformId = this.#getPlatformId(options.forciblySetPlatformId.toLowerCase())
        } else {
            const yandexUrl = ['y', 'a', 'n', 'd', 'e', 'x', '.', 'n', 'e', 't'].join('')
            if (url.searchParams.has('platform_id')) {
                platformId = this.#getPlatformId(url.searchParams.get('platform_id').toLowerCase())
            } else if (url.hostname.includes(yandexUrl) || url.hash.includes('yandex')) {
                platformId = PLATFORM_ID.YANDEX
            } else if (url.hostname.includes('crazygames.') || url.hostname.includes('1001juegos.com')) {
                platformId = PLATFORM_ID.CRAZY_GAMES
            } else if (url.hostname.includes('gamedistribution.com')) {
                platformId = PLATFORM_ID.GAME_DISTRIBUTION
            } else if (url.hostname.includes('lagged.')) {
                platformId = PLATFORM_ID.LAGGED
            } else if ((url.searchParams.has('api_id') && url.searchParams.has('viewer_id') && url.searchParams.has('auth_key')) || url.searchParams.has('vk_app_id')) {
                platformId = PLATFORM_ID.VK
            } else if (url.searchParams.has('app_id') && url.searchParams.has('player_id') && url.searchParams.has('game_sid') && url.searchParams.has('auth_key')) {
                platformId = PLATFORM_ID.ABSOLUTE_GAMES
            } else if (url.searchParams.has('playdeck')) {
                platformId = PLATFORM_ID.PLAYDECK
            } else if (url.hash.includes('tgWebAppData')) {
                platformId = PLATFORM_ID.TELEGRAM
            } else if (url.hostname.includes('y8')) {
                platformId = PLATFORM_ID.Y8
            } else if (url.hostname.includes('fbsbx')) {
                platformId = PLATFORM_ID.FACEBOOK
            } else if (url.hostname.includes('poki-gdn') || url.hostname.includes('poki-user-content')) {
                platformId = PLATFORM_ID.POKI
            } else if (url.hostname.includes('msn.') || url.hostname.includes('msnfun.') || url.hostname.includes('start.gg')) {
                platformId = PLATFORM_ID.MSN
            }
        }

        let modifiedOptions = options
        if (modifiedOptions.platforms?.[platformId]) {
            modifiedOptions = deepMerge(modifiedOptions, modifiedOptions.platforms[platformId])
        }

        delete modifiedOptions.platforms

        switch (platformId) {
            case PLATFORM_ID.VK: {
                this.#platformBridge = new VkPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.YANDEX: {
                this.#platformBridge = new YandexPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.CRAZY_GAMES: {
                this.#platformBridge = new CrazyGamesPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.ABSOLUTE_GAMES: {
                this.#platformBridge = new AbsoluteGamesPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.GAME_DISTRIBUTION: {
                this.#platformBridge = new GameDistributionPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.OK: {
                this.#platformBridge = new OkPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.PLAYGAMA: {
                this.#platformBridge = new PlaygamaPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.PLAYDECK: {
                this.#platformBridge = new PlayDeckPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.TELEGRAM: {
                this.#platformBridge = new TelegramPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.Y8: {
                this.#platformBridge = new Y8PlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.LAGGED: {
                this.#platformBridge = new LaggedPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.FACEBOOK: {
                this.#platformBridge = new FacebookPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.POKI: {
                this.#platformBridge = new PokiPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.QA_TOOL: {
                this.#platformBridge = new QaToolPlatformBridge(modifiedOptions)
                break
            }
            case PLATFORM_ID.MSN: {
                this.#platformBridge = new MsnPlatformBridge(modifiedOptions)
                break
            }
            default: {
                this.#platformBridge = new PlatformBridgeBase(modifiedOptions)
                break
            }
        }
    }

    #getPlatformId(value) {
        const platformIds = Object.values(PLATFORM_ID)
        for (let i = 0; i < platformIds.length; i++) {
            if (value === platformIds[i]) {
                return value
            }
        }

        return PLATFORM_ID.MOCK
    }

    #getModule(id) {
        if (!this.#isInitialized) {
            console.error(ERROR.SDK_NOT_INITIALIZED)
        }

        return this.#modules[id]
    }

    #createProgressLogo() {
        const style = document.createElement('style')
        style.textContent = `
            .fullscreen {
                background: #242424;
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0px;
                left: 0px;
            }

            #loading-overlay {
                font-size: 20px;
                z-index: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }

            #logo {
                width: 10%;
                max-width: 300px;
                min-width: 120px;
                overflow: visible;
            }

            .fill-rect {
                transform: translateY(100%);
                transition: transform 0.3s ease-out;
            }

            #gradientMover {
                display: none;
            }

            .gradient-mover {
                animation: moveGradient 0.4s linear;
            }

            @keyframes moveGradient {
                0% { transform: translateX(0); }
                100% { transform: translateX(-250%); }
            }

            .logo-fade-out {
                animation: logoFadeOut 1s linear;
            }

            .logo-fade-out path {
                fill: white;
                stroke: white;
            }

            @keyframes logoFadeOut {
                0% { opacity: 1; }
                50% { opacity: 0; }
                100% { opacity: 0; }
            }
        `
        document.head.appendChild(style)

        const overlay = document.createElement('div')
        overlay.id = 'loading-overlay'
        overlay.className = 'fullscreen'
        document.body.appendChild(overlay)

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('id', 'logo')
        svg.setAttribute('viewBox', '0 0 633 819')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

        const defs = document.createElementNS(svg.namespaceURI, 'defs')

        const mask = document.createElementNS(svg.namespaceURI, 'mask')
        mask.setAttribute('id', 'logo-mask')

        const blackRect = document.createElementNS(svg.namespaceURI, 'rect')
        blackRect.setAttribute('x', '0')
        blackRect.setAttribute('y', '0')
        blackRect.setAttribute('width', '100%')
        blackRect.setAttribute('height', '100%')
        blackRect.setAttribute('fill', 'black')
        mask.appendChild(blackRect)

        const whitePaths = [
            'M632 1V632H1V1H632ZM350 125.586V507.414L380.586 538H546V451H478.599L478.308 451.278L454.598 474H443.406L450.944 452.328L451 452.169V187.459L457.369 182H546V95H380.586L350 125.586ZM283 125.586L252.414 95H87V182H175.631L182 187.459V445.54L175.631 451H87V538H252.414L283 507.414V125.586Z',
            'M633 687V660H548V687H560V791H548V819H633V792H601L592 801H587L590 792V752H627V725H590V687H633Z',
            'M533 718V675L518 660H450L435 675V802L450 819H518L533 804V734H482V761H503V788L499 792H476L467 801H462L465 792V691L469 687H499L503 691V718H533Z',
            'M402 660H310V687H322V792H310V819H402L417 804V675L402 660ZM387 788L383 792H363L354 801H349L352 792V687H383L387 691V788Z',
            'M295 687V660H239V687H251V792H239V819H295V792H283V687H295Z',
            'M215 791L200 760H209L224 745V675L209 660H121V687H132V792H121V819H162V760H166L193 819H227V791H215ZM194 729L190 733H173L164 742H159L162 733V687H190L194 691V729Z',
            'M106 724V675L91 660H0V687H12V792H0V819H91L106 804V749L89 744V728L106 724ZM73 788L69 792H53L44 801H39L42 792V752H73V788ZM73 725H53L44 734H39L42 725V687H69L73 691V725Z',
        ]

        whitePaths.forEach((d) => {
            const path = document.createElementNS(svg.namespaceURI, 'path')
            path.setAttribute('d', d)
            path.setAttribute('fill', 'white')
            mask.appendChild(path)
        })

        defs.appendChild(mask)

        const gradient = document.createElementNS(svg.namespaceURI, 'linearGradient')
        gradient.setAttribute('id', 'shineGradient')
        gradient.setAttribute('x1', '1233')
        gradient.setAttribute('y1', '0')
        gradient.setAttribute('x2', '1866')
        gradient.setAttribute('y2', '633')
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse')

        const stops = [
            { offset: '0.235577', color: '#aa76ff' },
            { offset: '0.240685', color: 'white' },
            { offset: '0.659749', color: '#aa76ff' },
        ]

        stops.forEach(({ offset, color }) => {
            const stop = document.createElementNS(svg.namespaceURI, 'stop')
            stop.setAttribute('offset', offset)
            stop.setAttribute('stop-color', color)
            gradient.appendChild(stop)
        })

        defs.appendChild(gradient)
        svg.appendChild(defs)

        // gradient rect group
        const gradGroup = document.createElementNS(svg.namespaceURI, 'g')
        gradGroup.setAttribute('mask', 'url(#logo-mask)')

        const gradRect = document.createElementNS(svg.namespaceURI, 'rect')
        gradRect.setAttribute('id', 'gradientMover')
        gradRect.setAttribute('x', '0')
        gradRect.setAttribute('y', '0')
        gradRect.setAttribute('width', '2532')
        gradRect.setAttribute('height', '819')
        gradRect.setAttribute('fill', 'url(#shineGradient)')
        gradRect.style.transform = 'translateX(0)'
        gradGroup.appendChild(gradRect)
        svg.appendChild(gradGroup)

        // fill rect group
        const fillGroup = document.createElementNS(svg.namespaceURI, 'g')
        fillGroup.setAttribute('mask', 'url(#logo-mask)')

        const fillRect = document.createElementNS(svg.namespaceURI, 'rect')
        fillRect.setAttribute('id', 'fillRect')
        fillRect.setAttribute('class', 'fill-rect')
        fillRect.setAttribute('x', '0')
        fillRect.setAttribute('y', '0')
        fillRect.setAttribute('width', '100%')
        fillRect.setAttribute('height', '819')
        fillRect.setAttribute('fill', '#aa76ff')
        fillGroup.appendChild(fillRect)
        svg.appendChild(fillGroup)

        // stroked paths
        whitePaths.forEach((d) => {
            const outline = document.createElementNS(svg.namespaceURI, 'path')
            outline.setAttribute('d', d)
            outline.setAttribute('stroke', '#aa76ff')
            outline.setAttribute('stroke-width', '3')
            svg.appendChild(outline)
        })

        overlay.appendChild(svg)
    }

    _setLoadingProgressCalled = false

    setLoadingProgress(percent) {
        this._setLoadingProgressCalled = true
        const fill = document.getElementById('fillRect')
        const gradientMover = document.getElementById('gradientMover')
        const logo = document.getElementById('logo')
        const loadingOverlay = document.getElementById('loading-overlay')

        const _percent = Math.max(0, Math.min(100, percent))
        const translateY = 100 - _percent
        fill.style.transform = `translateY(${translateY}%)`

        if (_percent === 100) {
            setTimeout(() => {
                gradientMover.style.display = 'block'
                gradientMover.classList.add('gradient-mover')
            }, 400)
            setTimeout(() => logo.classList.add('logo-fade-out'), 900)
            setTimeout(() => loadingOverlay.remove(), 1400)
        } else {
            gradientMover.classList.remove('gradient-mover')
        }
    }
}

export default PlaygamaBridge
