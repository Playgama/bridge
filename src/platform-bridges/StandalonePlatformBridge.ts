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
import { PLATFORM_ID, type PlatformId } from '../modules/platform/constants'
import { getPaymentsProductPlatformData } from '../modules/payments'
import { DEFAULT_PRICE_CURRENCY_CODE, GAM_PER_USD } from '../modules/payments/constants'
import type { AnyRecord } from '../utils'

class StandalonePlatformBridge extends PlaygamaPlatformBridge {
    get platformId(): PlatformId {
        return PLATFORM_ID.STANDALONE
    }

    get sdkUrl(): string {
        return 'https://playgama.com/platform-sdk/wrap.v1.js'
    }

    get sdkGlobalName(): string {
        return 'PLAYGAMA_WRAP'
    }

    get isPlatformExternalLinksAllowed(): boolean {
        return true
    }

    protected _isAdvancedBannersSupported = true

    // payments
    paymentsGetCatalog(): Promise<unknown> {
        const products = this._paymentsGetProductsPlatformData()
        if (!products) {
            return Promise.reject()
        }

        const updatedProducts = products.map((product) => {
            const { price, currency } = this.#resolveProductPrice(product)
            return {
                id: product.id,
                price: price !== null ? `${price} ${currency}` : null,
                priceCurrencyCode: price !== null ? currency : null,
                priceValue: price,
            }
        })

        return Promise.resolve(updatedProducts)
    }

    #resolveProductPrice(product: AnyRecord): { price: number | null; currency: string } {
        const price = this.#parsePrice(product.amount)
        if (price !== null) {
            const currency = typeof product.currency === 'string' && product.currency !== ''
                ? product.currency
                : DEFAULT_PRICE_CURRENCY_CODE
            return { price, currency }
        }

        const playgamaProduct = getPaymentsProductPlatformData(
            this._options.payments,
            PLATFORM_ID.PLAYGAMA,
            product.id as string,
        )

        const playgamaAmount = this.#parsePrice(playgamaProduct?.amount)
        if (playgamaAmount !== null) {
            return { price: playgamaAmount / GAM_PER_USD, currency: DEFAULT_PRICE_CURRENCY_CODE }
        }

        return { price: null, currency: DEFAULT_PRICE_CURRENCY_CODE }
    }

    #parsePrice(value: unknown): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value
        }

        if (typeof value === 'string' && value !== '') {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) {
                return parsed
            }
        }

        return null
    }
}

export default StandalonePlatformBridge
