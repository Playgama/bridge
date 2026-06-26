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

export const GUEST_ID_STORAGE_KEY = 'bridge-player-guest-id'

// Key used by SDK v1 (main). Read once on upgrade so existing guest players keep
// their stable identity, then re-persisted under GUEST_ID_STORAGE_KEY.
export const LEGACY_GUEST_ID_STORAGE_KEY = 'bridge_player_guest_id'
