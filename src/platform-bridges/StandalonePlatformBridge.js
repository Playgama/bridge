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
import { DEFAULT_PRICE_CURRENCY_CODE, GAM_PER_USD, PLATFORM_ID } from '../constants'

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

    _isAdvancedBannersSupported = true

    // payments
    paymentsGetCatalog() {
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

    #resolveProductPrice(product) {
        const price = this.#parsePrice(product.amount)
        if (price !== null) {
            const currency = typeof product.currency === 'string' && product.currency !== ''
                ? product.currency
                : DEFAULT_PRICE_CURRENCY_CODE
            return { price, currency }
        }

        const playgamaProduct = this.#getPlaygamaProductPlatformData(product.id)

        const playgamaAmount = this.#parsePrice(playgamaProduct?.amount)
        if (playgamaAmount !== null) {
            return { price: playgamaAmount / GAM_PER_USD, currency: DEFAULT_PRICE_CURRENCY_CODE }
        }

        return { price: null, currency: DEFAULT_PRICE_CURRENCY_CODE }
    }

    #getPlaygamaProductPlatformData(id) {
        const products = this._options.payments
        if (!products) {
            return null
        }

        const product = products.find((p) => p.id === id)
        if (!product) {
            return null
        }

        return { ...product[PLATFORM_ID.PLAYGAMA], id: product.id }
    }

    #parsePrice(value) {
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
