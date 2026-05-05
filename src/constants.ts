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

export const SAAS_URL = 'https://playgama.com/api/bridge/v1'
export const TIMESTAMP_URL = 'https://playgama.com/api/v1/timestamp/now'

export const PLATFORM_ID = {
    VK: 'vk',
    OK: 'ok',
    YANDEX: 'yandex',
    CRAZY_GAMES: 'crazy_games',
    ABSOLUTE_GAMES: 'absolute_games',
    GAME_DISTRIBUTION: 'game_distribution',
    PLAYGAMA: 'playgama',
    PLAYDECK: 'playdeck',
    TELEGRAM: 'telegram',
    Y8: 'y8',
    LAGGED: 'lagged',
    FACEBOOK: 'facebook',
    POKI: 'poki',
    MOCK: 'mock',
    QA_TOOL: 'qa_tool',
    MSN: 'msn',
    MICROSOFT_STORE: 'microsoft_store',
    HUAWEI: 'huawei',
    BITQUEST: 'bitquest',
    GAMEPUSH: 'gamepush',
    DISCORD: 'discord',
    JIO_GAMES: 'jio_games',
    YOUTUBE: 'youtube',
    PORTAL: 'portal',
    REDDIT: 'reddit',
    XIAOMI: 'xiaomi',
    TIKTOK: 'tiktok',
    DLIGHTEK: 'dlightek',
    GAMESNACKS: 'gamesnacks',
} as const
export type PlatformId = typeof PLATFORM_ID[keyof typeof PLATFORM_ID]

export const MODULE_NAME = {
    CORE: 'core',
    PLATFORM: 'platform',
    PLAYER: 'player',
    GAME: 'game',
    STORAGE: 'storage',
    ADVERTISEMENT: 'advertisement',
    SOCIAL: 'social',
    DEVICE: 'device',
    LEADERBOARDS: 'leaderboards',
    PAYMENTS: 'payments',
    REMOTE_CONFIG: 'remote_config',
    CLIPBOARD: 'clipboard',
    ACHIEVEMENTS: 'achievements',
    ANALYTICS: 'analytics',
    RECORDER: 'recorder',
} as const
export type ModuleName = typeof MODULE_NAME[keyof typeof MODULE_NAME]

export const EVENT_NAME = {
    INTERSTITIAL_STATE_CHANGED: 'interstitial_state_changed',
    REWARDED_STATE_CHANGED: 'rewarded_state_changed',
    BANNER_STATE_CHANGED: 'banner_state_changed',
    ADVANCED_BANNERS_STATE_CHANGED: 'advanced_banners_state_changed',
    VISIBILITY_STATE_CHANGED: 'visibility_state_changed',
    AUDIO_STATE_CHANGED: 'audio_state_changed',
    PAUSE_STATE_CHANGED: 'pause_state_changed',
    ORIENTATION_STATE_CHANGED: 'orientation_state_changed',
    SCREEN_SIZE_CHANGED: 'screen_size_changed',
    PLATFORM_MESSAGE_SENT: 'platform_message_sent',
    DEFAULT_STORAGE_TYPE_CHANGED: 'default_storage_type_changed',
} as const
export type EventName = typeof EVENT_NAME[keyof typeof EVENT_NAME]

export const VISIBILITY_STATE = {
    VISIBLE: 'visible',
    HIDDEN: 'hidden',
} as const
export type VisibilityState = typeof VISIBILITY_STATE[keyof typeof VISIBILITY_STATE]

export const INTERSTITIAL_STATE = {
    LOADING: 'loading',
    OPENED: 'opened',
    CLOSED: 'closed',
    FAILED: 'failed',
} as const
export type InterstitialState = typeof INTERSTITIAL_STATE[keyof typeof INTERSTITIAL_STATE]

export const REWARDED_STATE = {
    LOADING: 'loading',
    OPENED: 'opened',
    CLOSED: 'closed',
    FAILED: 'failed',
    REWARDED: 'rewarded',
} as const
export type RewardedState = typeof REWARDED_STATE[keyof typeof REWARDED_STATE]

export const BANNER_STATE = {
    LOADING: 'loading',
    SHOWN: 'shown',
    HIDDEN: 'hidden',
    FAILED: 'failed',
} as const
export type BannerState = typeof BANNER_STATE[keyof typeof BANNER_STATE]

export const BANNER_POSITION = {
    TOP: 'top',
    BOTTOM: 'bottom',
} as const
export type BannerPosition = typeof BANNER_POSITION[keyof typeof BANNER_POSITION]

export const ADVANCED_BANNERS_ACTION = {
    SHOW: 'show',
    HIDE: 'hide',
} as const
export type AdvancedBannersAction = typeof ADVANCED_BANNERS_ACTION[keyof typeof ADVANCED_BANNERS_ACTION]

export const BANNER_CONTAINER_ID = 'banner-container'
export const ADVANCED_BANNER_CONTAINER_ID_PREFIX = 'advanced-banner-'
export const INTERSTITIAL_CONTAINER_ID = 'interstitial-container'
export const REWARDED_CONTAINER_ID = 'rewarded-container'

export const STORAGE_TYPE = {
    LOCAL_STORAGE: 'local_storage',
    PLATFORM_INTERNAL: 'platform_internal',
} as const
export type StorageType = typeof STORAGE_TYPE[keyof typeof STORAGE_TYPE]

export const CLOUD_STORAGE_MODE = {
    NONE: 'none',
    EAGER: 'eager',
    LAZY: 'lazy',
} as const
export type CloudStorageMode = typeof CLOUD_STORAGE_MODE[keyof typeof CLOUD_STORAGE_MODE]

export const DEVICE_TYPE = {
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
    TABLET: 'tablet',
    TV: 'tv',
} as const
export type DeviceType = typeof DEVICE_TYPE[keyof typeof DEVICE_TYPE]

export const DEVICE_OS = {
    WINDOWS: 'windows',
    MACOS: 'macos',
    LINUX: 'linux',
    ANDROID: 'android',
    IOS: 'ios',
    OTHER: 'other',
} as const
export type DeviceOs = typeof DEVICE_OS[keyof typeof DEVICE_OS]

export const DEVICE_ORIENTATION = {
    PORTRAIT: 'portrait',
    LANDSCAPE: 'landscape',
} as const
export type DeviceOrientation = typeof DEVICE_ORIENTATION[keyof typeof DEVICE_ORIENTATION]

export const ORIENTATION_OVERLAY_ID = 'bridge-orientation-overlay'

export const PLATFORM_MESSAGE = {
    GAME_READY: 'game_ready',
    LEVEL_STARTED: 'level_started',
    LEVEL_COMPLETED: 'level_completed',
    LEVEL_FAILED: 'level_failed',
    LEVEL_PAUSED: 'level_paused',
    LEVEL_RESUMED: 'level_resumed',
    IN_GAME_LOADING_STARTED: 'in_game_loading_started',
    IN_GAME_LOADING_STOPPED: 'in_game_loading_stopped',
    GAMEPLAY_STARTED: 'gameplay_started',
    GAMEPLAY_STOPPED: 'gameplay_stopped',
    PLAYER_GOT_ACHIEVEMENT: 'player_got_achievement',
} as const
export type PlatformMessage = typeof PLATFORM_MESSAGE[keyof typeof PLATFORM_MESSAGE]

export const LEADERBOARD_TYPE = {
    NOT_AVAILABLE: 'not_available',
    IN_GAME: 'in_game',
    NATIVE: 'native',
    NATIVE_POPUP: 'native_popup',
} as const
export type LeaderboardType = typeof LEADERBOARD_TYPE[keyof typeof LEADERBOARD_TYPE]

export const ACTION_NAME = {
    INITIALIZE: 'initialize',
    AUTHORIZE_PLAYER: 'authorize_player',
    SHARE: 'share',
    INVITE_FRIENDS: 'invite_friends',
    JOIN_COMMUNITY: 'join_community',
    CREATE_POST: 'create_post',
    ADD_TO_HOME_SCREEN: 'add_to_home_screen',
    ADD_TO_FAVORITES: 'add_to_favorites',
    RATE: 'rate',
    LEADERBOARDS_SET_SCORE: 'leaderboards_set_score',
    LEADERBOARDS_GET_ENTRIES: 'leaderboards_get_entries',
    LEADERBOARDS_SHOW_NATIVE_POPUP: 'leaderboards_show_native_popup',
    GET_PURCHASES: 'get_purchases',
    GET_CATALOG: 'get_catalog',
    PURCHASE: 'purchase',
    CONSUME_PURCHASE: 'consume_purchase',
    GET_REMOTE_CONFIG: 'get_remote_config',
    GET_STORAGE_DATA: 'get_storage_data',
    SET_STORAGE_DATA: 'set_storage_data',
    DELETE_STORAGE_DATA: 'delete_storage_data',
    CLIPBOARD_WRITE: 'clipboard_write',
    ADBLOCK_DETECT: 'adblock_detect',
    SET_INTERSTITIAL_STATE: 'set_interstitial_state',
    SET_REWARDED_STATE: 'set_rewarded_state',
    SHOW_INTERSTITIAL: 'show_interstitial',
    SHOW_REWARDED: 'show_rewarded',
} as const
export type ActionName = typeof ACTION_NAME[keyof typeof ACTION_NAME]

export interface BridgeError {
    message: string
}

export const ERROR: Record<
'SDK_NOT_INITIALIZED'
| 'STORAGE_NOT_SUPPORTED'
| 'STORAGE_NOT_AVAILABLE'
| 'STORAGE_QUOTA_EXCEEDED'
| 'GAME_PARAMS_NOT_FOUND'
| 'INVITE_FRIENDS_MESSAGE_LENGTH_ERROR',
BridgeError
> = {
    SDK_NOT_INITIALIZED: { message: 'Before using the SDK you must initialize it' },
    STORAGE_NOT_SUPPORTED: { message: 'Storage not supported' },
    STORAGE_NOT_AVAILABLE: { message: 'Storage not available' },
    STORAGE_QUOTA_EXCEEDED: { message: 'Storage quota exceeded' },
    GAME_PARAMS_NOT_FOUND: { message: 'Game params are not found' },
    INVITE_FRIENDS_MESSAGE_LENGTH_ERROR: { message: 'Message is too long' },
}
