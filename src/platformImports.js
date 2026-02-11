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

if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'vk') {
    platformImports[PLATFORM_ID.VK] = () => import('./platform-bridges/VkPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'ok') {
    platformImports[PLATFORM_ID.OK] = () => import('./platform-bridges/OkPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'yandex') {
    platformImports[PLATFORM_ID.YANDEX] = () => import('./platform-bridges/YandexPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'crazy_games') {
    platformImports[PLATFORM_ID.CRAZY_GAMES] = () => import('./platform-bridges/CrazyGamesPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'absolute_games') {
    platformImports[PLATFORM_ID.ABSOLUTE_GAMES] = () => import('./platform-bridges/AbsoluteGamesPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'game_distribution') {
    platformImports[PLATFORM_ID.GAME_DISTRIBUTION] = () => import('./platform-bridges/GameDistributionPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'playgama') {
    platformImports[PLATFORM_ID.PLAYGAMA] = () => import('./platform-bridges/PlaygamaPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'playdeck') {
    platformImports[PLATFORM_ID.PLAYDECK] = () => import('./platform-bridges/PlayDeckPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'telegram') {
    platformImports[PLATFORM_ID.TELEGRAM] = () => import('./platform-bridges/TelegramPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'y8') {
    platformImports[PLATFORM_ID.Y8] = () => import('./platform-bridges/Y8PlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'lagged') {
    platformImports[PLATFORM_ID.LAGGED] = () => import('./platform-bridges/LaggedPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'facebook') {
    platformImports[PLATFORM_ID.FACEBOOK] = () => import('./platform-bridges/FacebookPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'poki') {
    platformImports[PLATFORM_ID.POKI] = () => import('./platform-bridges/PokiPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'qa_tool') {
    platformImports[PLATFORM_ID.QA_TOOL] = () => import('./platform-bridges/QaToolPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'msn') {
    platformImports[PLATFORM_ID.MSN] = () => import('./platform-bridges/MsnPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'microsoft_store') {
    platformImports[PLATFORM_ID.MICROSOFT_STORE] = () => import('./platform-bridges/MicrosoftStorePlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'huawei') {
    platformImports[PLATFORM_ID.HUAWEI] = () => import('./platform-bridges/HuaweiPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'bitquest') {
    platformImports[PLATFORM_ID.BITQUEST] = () => import('./platform-bridges/BitquestPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'gamepush') {
    platformImports[PLATFORM_ID.GAMEPUSH] = () => import('./platform-bridges/GamePushPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'discord') {
    platformImports[PLATFORM_ID.DISCORD] = () => import('./platform-bridges/DiscordPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'jio_games') {
    platformImports[PLATFORM_ID.JIO_GAMES] = () => import('./platform-bridges/JioGamesPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'youtube') {
    platformImports[PLATFORM_ID.YOUTUBE] = () => import('./platform-bridges/YoutubePlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'portal') {
    platformImports[PLATFORM_ID.PORTAL] = () => import('./platform-bridges/PortalPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'reddit') {
    platformImports[PLATFORM_ID.REDDIT] = () => import('./platform-bridges/RedditPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'xiaomi') {
    platformImports[PLATFORM_ID.XIAOMI] = () => import('./platform-bridges/XiaomiPlatformBridge')
}
if (!__TARGET_PLATFORM__ || __TARGET_PLATFORM__ === 'tiktok') {
    platformImports[PLATFORM_ID.TIKTOK] = () => import('./platform-bridges/TikTokPlatformBridge')
}

export async function fetchPlatformBridge(platformId) {
    const importPlatform = platformImports[platformId]
    if (importPlatform) {
        const { default: PlatformBridge } = await importPlatform()
        return PlatformBridge
    }
    return PlatformBridgeBase
}
