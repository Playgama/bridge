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

const platformImports = {}

if (__INCLUDE_VK__) {
    platformImports[PLATFORM_ID.VK] = () => import('./platform-bridges/VkPlatformBridge')
}
if (__INCLUDE_OK__) {
    platformImports[PLATFORM_ID.OK] = () => import('./platform-bridges/OkPlatformBridge')
}
if (__INCLUDE_YANDEX__) {
    platformImports[PLATFORM_ID.YANDEX] = () => import('./platform-bridges/YandexPlatformBridge')
}
if (__INCLUDE_CRAZY_GAMES__) {
    platformImports[PLATFORM_ID.CRAZY_GAMES] = () => import('./platform-bridges/CrazyGamesPlatformBridge')
}
if (__INCLUDE_ABSOLUTE_GAMES__) {
    platformImports[PLATFORM_ID.ABSOLUTE_GAMES] = () => import('./platform-bridges/AbsoluteGamesPlatformBridge')
}
if (__INCLUDE_GAME_DISTRIBUTION__) {
    platformImports[PLATFORM_ID.GAME_DISTRIBUTION] = () => import('./platform-bridges/GameDistributionPlatformBridge')
}
if (__INCLUDE_PLAYGAMA__) {
    platformImports[PLATFORM_ID.PLAYGAMA] = () => import('./platform-bridges/PlaygamaPlatformBridge')
}
if (__INCLUDE_PLAYDECK__) {
    platformImports[PLATFORM_ID.PLAYDECK] = () => import('./platform-bridges/PlayDeckPlatformBridge')
}
if (__INCLUDE_TELEGRAM__) {
    platformImports[PLATFORM_ID.TELEGRAM] = () => import('./platform-bridges/TelegramPlatformBridge')
}
if (__INCLUDE_Y8__) {
    platformImports[PLATFORM_ID.Y8] = () => import('./platform-bridges/Y8PlatformBridge')
}
if (__INCLUDE_LAGGED__) {
    platformImports[PLATFORM_ID.LAGGED] = () => import('./platform-bridges/LaggedPlatformBridge')
}
if (__INCLUDE_FACEBOOK__) {
    platformImports[PLATFORM_ID.FACEBOOK] = () => import('./platform-bridges/FacebookPlatformBridge')
}
if (__INCLUDE_POKI__) {
    platformImports[PLATFORM_ID.POKI] = () => import('./platform-bridges/PokiPlatformBridge')
}
if (__INCLUDE_QA_TOOL__) {
    platformImports[PLATFORM_ID.QA_TOOL] = () => import('./platform-bridges/QaToolPlatformBridge')
}
if (__INCLUDE_MSN__) {
    platformImports[PLATFORM_ID.MSN] = () => import('./platform-bridges/MsnPlatformBridge')
}
if (__INCLUDE_MICROSOFT_STORE__) {
    platformImports[PLATFORM_ID.MICROSOFT_STORE] = () => import('./platform-bridges/MicrosoftStorePlatformBridge')
}
if (__INCLUDE_HUAWEI__) {
    platformImports[PLATFORM_ID.HUAWEI] = () => import('./platform-bridges/HuaweiPlatformBridge')
}
if (__INCLUDE_BITQUEST__) {
    platformImports[PLATFORM_ID.BITQUEST] = () => import('./platform-bridges/BitquestPlatformBridge')
}
if (__INCLUDE_GAMEPUSH__) {
    platformImports[PLATFORM_ID.GAMEPUSH] = () => import('./platform-bridges/GamePushPlatformBridge')
}
if (__INCLUDE_DISCORD__) {
    platformImports[PLATFORM_ID.DISCORD] = () => import('./platform-bridges/DiscordPlatformBridge')
}
if (__INCLUDE_JIO_GAMES__) {
    platformImports[PLATFORM_ID.JIO_GAMES] = () => import('./platform-bridges/JioGamesPlatformBridge')
}
if (__INCLUDE_YOUTUBE__) {
    platformImports[PLATFORM_ID.YOUTUBE] = () => import('./platform-bridges/YoutubePlatformBridge')
}
if (__INCLUDE_PORTAL__) {
    platformImports[PLATFORM_ID.PORTAL] = () => import('./platform-bridges/PortalPlatformBridge')
}
if (__INCLUDE_REDDIT__) {
    platformImports[PLATFORM_ID.REDDIT] = () => import('./platform-bridges/RedditPlatformBridge')
}
if (__INCLUDE_XIAOMI__) {
    platformImports[PLATFORM_ID.XIAOMI] = () => import('./platform-bridges/XiaomiPlatformBridge')
}
if (__INCLUDE_TIKTOK__) {
    platformImports[PLATFORM_ID.TIKTOK] = () => import('./platform-bridges/TikTokPlatformBridge')
}
if (__INCLUDE_GAMESNACKS__) {
    platformImports[PLATFORM_ID.GAMESNACKS] = () => import('./platform-bridges/GameSnacksPlatformBridge')
}

export async function fetchPlatformBridge(platformId) {
    const importPlatform = platformImports[platformId]
    if (importPlatform) {
        const { default: PlatformBridge } = await importPlatform()
        return PlatformBridge
    }
    return PlatformBridgeBase
}
