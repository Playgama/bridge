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
    DAILY_REWARDS_CLAIM: 'daily_rewards_claim',
    DAILY_REWARDS_RESET: 'daily_rewards_reset',
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
