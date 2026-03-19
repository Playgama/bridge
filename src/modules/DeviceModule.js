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

import eventBus, { applyEventBusMixin } from '../common/EventBus'
import ModuleBase from './ModuleBase'
import {
    EVENT_NAME, DEVICE_ORIENTATION, DEVICE_TYPE,
} from '../constants'
import { createOrientationOverlay, detectOrientation, getSafeArea } from '../common/utils'

class DeviceModule extends ModuleBase {
    get type() {
        return this._platformBridge.deviceType
    }

    get os() {
        return this._platformBridge.deviceOs
    }

    get orientation() {
        return this.#currentOrientation
    }

    get safeArea() {
        return this._platformBridge.safeArea ?? getSafeArea()
    }

    #currentOrientation = null

    #overlayElement = null

    #supportedOrientations = null

    #useBuiltInOverlay = false

    constructor(platformBridge) {
        super(platformBridge)
        this.#initializeOrientationTracking()
    }

    #initializeOrientationTracking() {
        const { deviceType } = this._platformBridge
        const isMobileDevice = deviceType === DEVICE_TYPE.MOBILE || deviceType === DEVICE_TYPE.TABLET

        if (!isMobileDevice) {
            return
        }

        const deviceConfig = this._platformBridge.options?.device
        this.#useBuiltInOverlay = deviceConfig?.useBuiltInOrientationPopup ?? false
        this.#supportedOrientations = deviceConfig?.supportedOrientations ?? [
            DEVICE_ORIENTATION.PORTRAIT,
            DEVICE_ORIENTATION.LANDSCAPE,
        ]

        this.#currentOrientation = detectOrientation()

        if (window.screen.orientation) {
            window.screen.orientation.addEventListener('change', () => this.#handleOrientationChange())
        } else {
            window.addEventListener('orientationchange', () => this.#handleOrientationChange())
        }
        window.addEventListener('resize', () => this.#handleOrientationChange())

        this.#updateOverlay()
    }

    #handleOrientationChange() {
        const newOrientation = detectOrientation()
        if (newOrientation !== this.#currentOrientation) {
            this.#currentOrientation = newOrientation
            eventBus.emit(EVENT_NAME.ORIENTATION_STATE_CHANGED, this.#currentOrientation)
            this.#updateOverlay()
        }
    }

    #updateOverlay() {
        if (!this.#useBuiltInOverlay) {
            return
        }

        if (this.#supportedOrientations.length !== 1) {
            this.#hideOverlay()
            return
        }

        const supportedOrientation = this.#supportedOrientations[0]
        if (this.#currentOrientation !== supportedOrientation) {
            this.#showOverlay()
        } else {
            this.#hideOverlay()
        }
    }

    #showOverlay() {
        if (this.#overlayElement) {
            return
        }
        this.#overlayElement = createOrientationOverlay()
        document.body.appendChild(this.#overlayElement)
    }

    #hideOverlay() {
        if (this.#overlayElement) {
            this.#overlayElement.remove()
            this.#overlayElement = null
        }
    }
}

applyEventBusMixin(DeviceModule.prototype)
export default DeviceModule
