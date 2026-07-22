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

import ModuleBase, { type PlatformBridgeLike } from '../ModuleBase'
import type { PlatformId } from '../platform/constants'
import { BridgeError, ERROR_CODE } from '../../constants'
import type { ScheduledNotification } from './types'
import bridgeConfig from '../../lib/bridge-config'

export interface NotificationsBridgeContract extends PlatformBridgeLike {
    platformId: PlatformId
    isNotificationsSupported: boolean
    notificationsLaunchPayload: string | null
    notificationsSchedule(
        notification: ScheduledNotification,
        platformValue?: string | number,
    ): Promise<unknown>
}

class NotificationsModule extends ModuleBase<NotificationsBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isNotificationsSupported
    }

    schedule(notification: ScheduledNotification): Promise<unknown> {
        const validationError = this.#validate(notification)
        if (validationError) {
            return Promise.reject(new BridgeError(ERROR_CODE.NOTIFICATION_INVALID_PARAMETERS, validationError))
        }

        const platformValue = this.#getPlatformNotificationValue(notification.id)
        return this._platformBridge.notificationsSchedule(notification, platformValue)
    }

    getLaunchPayload(): string | null {
        return this._platformBridge.notificationsLaunchPayload
    }

    #validate(notification: ScheduledNotification): string | null {
        if (!notification || typeof notification !== 'object') {
            return 'Notification must be an object'
        }

        if (typeof notification.id !== 'string' || notification.id.length === 0) {
            return 'Notification "id" must be a non-empty string'
        }

        if (typeof notification.title !== 'string' || notification.title.length === 0) {
            return 'Notification "title" must be a non-empty string'
        }

        if (typeof notification.description !== 'string' || notification.description.length === 0) {
            return 'Notification "description" must be a non-empty string'
        }

        if (notification.delaySeconds !== undefined
            && (!Number.isInteger(notification.delaySeconds) || notification.delaySeconds < 0)) {
            return 'Notification "delaySeconds" must be a non-negative integer'
        }

        const optionalStringFields = ['image', 'callToAction', 'payload'] as const
        const invalidField = optionalStringFields.find((field) => {
            const value = notification[field]
            return value !== undefined && typeof value !== 'string'
        })
        if (invalidField) {
            return `Notification "${invalidField}" must be a string`
        }

        return null
    }

    #getPlatformNotificationValue(id: string): string | number | undefined {
        const { notifications } = bridgeConfig.getValues()
        if (!notifications) {
            return undefined
        }

        const notification = notifications.find((n) => n.id === id)
        if (!notification) {
            return undefined
        }

        const platformValue = notification[this._platformBridge.platformId]
        if (typeof platformValue === 'string' || typeof platformValue === 'number') {
            return platformValue
        }

        return undefined
    }
}

export default NotificationsModule
