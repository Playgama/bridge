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

import PlaygamaPlatformBridge from './PlaygamaPlatformBridge'
import { PLATFORM_ID } from '../constants'

class StandalonePlatformBridge extends PlaygamaPlatformBridge {
    get platformId() {
        return PLATFORM_ID.STANDALONE
    }

    get sdkUrl() {
        return 'https://playgama.com/platform-sdk/wrap.v1.js'
    }

    get sdkGlobalName() {
        return 'PLAYGAMA_WRAP'
    }

    get isExternalLinksAllowed() {
        return true
    }

    _isAdvancedBannersSupported = false
}

export default StandalonePlatformBridge
