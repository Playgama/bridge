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

import bridgeConfig from './BridgeConfig'

export {
    BridgeConfig,
    LOAD_STATUS,
    PARSE_STATUS,
    type LoadStatus,
    type ParseStatus,
} from './BridgeConfig'

export type {
    ConfigFileOptions,
    SaasConfig,
    SaasFeatureConfig,
    GameConfig,
} from './types'

export {
    default as RemoteConfigLoader,
    REMOTE_LOAD_STATUS,
    REMOTE_APPLIED_SOURCE,
    type RemoteLoadStatus,
    type RemoteAppliedSource,
    type RemoteConfigLoaderOptions,
    type RemoteConfigLoadResult,
} from './RemoteConfigLoader'

export {
    REMOTE_CONFIG_CACHE_STORAGE_KEY,
    REMOTE_CONFIG_DEFAULT_TIMEOUT,
    REMOTE_CONFIG_DEFAULT_TTL,
    LOCAL_ONLY_CONFIG_FIELDS,
} from './constants'

export default bridgeConfig
