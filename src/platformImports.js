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

import { PLATFORM_ID } from './constants'
import PlatformBridgeBase from './platform-bridges/PlatformBridgeBase'

const platformImports = {
    [PLATFORM_ID.VK]: () => import('./platform-bridges/VkPlatformBridge'),
    [PLATFORM_ID.YANDEX]: () => import('./platform-bridges/YandexPlatformBridge'),
    [PLATFORM_ID.CRAZY_GAMES]: () => import('./platform-bridges/CrazyGamesPlatformBridge'),
    [PLATFORM_ID.ABSOLUTE_GAMES]: () => import('./platform-bridges/AbsoluteGamesPlatformBridge'),
    [PLATFORM_ID.GAME_DISTRIBUTION]: () => import('./platform-bridges/GameDistributionPlatformBridge'),
    [PLATFORM_ID.OK]: () => import('./platform-bridges/OkPlatformBridge'),
    [PLATFORM_ID.PLAYGAMA]: () => import('./platform-bridges/PlaygamaPlatformBridge'),
    [PLATFORM_ID.PLAYDECK]: () => import('./platform-bridges/PlayDeckPlatformBridge'),
    [PLATFORM_ID.TELEGRAM]: () => import('./platform-bridges/TelegramPlatformBridge'),
    [PLATFORM_ID.Y8]: () => import('./platform-bridges/Y8PlatformBridge'),
    [PLATFORM_ID.LAGGED]: () => import('./platform-bridges/LaggedPlatformBridge'),
    [PLATFORM_ID.FACEBOOK]: () => import('./platform-bridges/FacebookPlatformBridge'),
    [PLATFORM_ID.POKI]: () => import('./platform-bridges/PokiPlatformBridge'),
    [PLATFORM_ID.QA_TOOL]: () => import('./platform-bridges/QaToolPlatformBridge'),
    [PLATFORM_ID.MSN]: () => import('./platform-bridges/MsnPlatformBridge'),
    [PLATFORM_ID.HUAWEI]: () => import('./platform-bridges/HuaweiPlatformBridge'),
    [PLATFORM_ID.BITQUEST]: () => import('./platform-bridges/BitquestPlatformBridge'),
    [PLATFORM_ID.GAMEPUSH]: () => import('./platform-bridges/GamePushPlatformBridge'),
    [PLATFORM_ID.DISCORD]: () => import('./platform-bridges/DiscordPlatformBridge'),
    [PLATFORM_ID.YOUTUBE]: () => import('./platform-bridges/YoutubePlatformBridge'),
    [PLATFORM_ID.JIO_GAMES]: () => import('./platform-bridges/JioGamesPlatformBridge'),
    [PLATFORM_ID.PORTAL]: () => import('./platform-bridges/PortalPlatformBridge'),
    [PLATFORM_ID.REDDIT]: () => import('./platform-bridges/RedditPlatformBridge'),
    [PLATFORM_ID.XIAOMI]: () => import('./platform-bridges/XiaomiPlatformBridge'),
    [PLATFORM_ID.MICROSOFT_STORE]: () => import('./platform-bridges/MicrosoftStorePlatformBridge'),
    [PLATFORM_ID.TIKTOK]: () => import('./platform-bridges/TikTokPlatformBridge'),
}

export async function fetchPlatformBridge(platformId) {
    const importPlatform = platformImports[platformId]
    if (importPlatform) {
        const { default: PlatformBridge } = await importPlatform()
        return PlatformBridge
    }
    return PlatformBridgeBase
}
