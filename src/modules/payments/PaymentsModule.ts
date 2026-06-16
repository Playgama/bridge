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
import { internalAnalytics } from '../analytics'
import { MODULE_NAME } from '../../constants'

export interface PaymentsBridgeContract extends PlatformBridgeLike {
    isPaymentsSupported: boolean
    paymentsPurchase(id: string, options?: unknown): Promise<unknown>
    paymentsGetPurchases(): Promise<unknown>
    paymentsGetCatalog(): Promise<unknown>
    paymentsConsumePurchase(id: string): Promise<unknown>
}

class PaymentsModule extends ModuleBase<PaymentsBridgeContract> {
    get isSupported(): boolean {
        return this._platformBridge.isPaymentsSupported
    }

    purchase(id: string, options?: unknown): Promise<unknown> {
        if (!this._platformBridge.isPaymentsSupported) {
            return Promise.reject()
        }

        internalAnalytics.send(
            `${MODULE_NAME.PAYMENTS}_purchase_started`,
            { id },
        )

        return this._platformBridge.paymentsPurchase(id, options)
            .then((result) => {
                internalAnalytics.send(
                    `${MODULE_NAME.PAYMENTS}_purchase_completed`,
                    { id },
                )
                return result
            })
            .catch((error) => {
                internalAnalytics.send(
                    `${MODULE_NAME.PAYMENTS}_purchase_failed`,
                    { id },
                )
                throw error
            })
    }

    getPurchases(): Promise<unknown> {
        if (!this._platformBridge.isPaymentsSupported) {
            return Promise.reject()
        }

        return this._platformBridge.paymentsGetPurchases()
    }

    getCatalog(): Promise<unknown> {
        if (!this._platformBridge.isPaymentsSupported) {
            return Promise.reject()
        }

        return this._platformBridge.paymentsGetCatalog()
    }

    consumePurchase(id: string): Promise<unknown> {
        if (!this._platformBridge.isPaymentsSupported) {
            return Promise.reject()
        }

        internalAnalytics.send(
            `${MODULE_NAME.PAYMENTS}_consume_purchase_started`,
            { id },
        )

        return this._platformBridge.paymentsConsumePurchase(id)
            .then((result) => {
                internalAnalytics.send(
                    `${MODULE_NAME.PAYMENTS}_consume_purchase_completed`,
                    { id },
                )
                return result
            })
            .catch((error) => {
                internalAnalytics.send(
                    `${MODULE_NAME.PAYMENTS}_consume_purchase_failed`,
                    { id },
                )
                throw error
            })
    }
}

export default PaymentsModule
