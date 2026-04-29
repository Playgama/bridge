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

import eventBus from '../common/EventBus'
import { EVENT_NAME, PLATFORM_MESSAGE } from '../constants'
import ModuleBase from './ModuleBase'

class NotificationsModule extends ModuleBase {
    get isSupported() {
        return this._platformBridge.isNotificationsSupported
    }

    #autoSchedulingEnabled = false

    schedule(options) {
        return this._platformBridge.scheduleNotification(options)
    }

    getPayload() {
        return this._platformBridge.getNotificationPayload()
    }

    enableAutoScheduling() {
        if (this.#autoSchedulingEnabled) {
            return
        }

        if (!this.isSupported) {
            return
        }

        if (this._platformBridge.options?.notifications?.autoSchedule === false) {
            return
        }

        this.#autoSchedulingEnabled = true

        eventBus.on(EVENT_NAME.PLATFORM_MESSAGE_SENT, (message) => {
            // TEMP: debug logging for QA verification, remove before merge
            console.info('[NotificationsModule] PLATFORM_MESSAGE_SENT:', message)

            if (message !== PLATFORM_MESSAGE.GAME_READY) {
                return
            }

            this.schedule({
                title: 'Ready for another round?',
                description: 'Jump back in right where you left off.',
                type: 8,
                minDelayInSeconds: 86400,
            }).catch(() => {})

            this.schedule({
                title: 'Missing your moves',
                description: "It's perfect time to come back",
                type: 9,
                minDelayInSeconds: 259200,
            }).catch(() => {})

            this.schedule({
                title: 'We miss you',
                description: 'Seriously. Come play.',
                type: 10,
                minDelayInSeconds: 604800,
            }).catch(() => {})

            this.schedule({
                title: 'Got a quick minute?',
                description: 'A round is waiting for you.',
                type: 11,
                minDelayInSeconds: 300,
            }).catch(() => {})
        })
    }
}

export default NotificationsModule
