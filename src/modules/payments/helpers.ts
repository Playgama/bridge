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

import type { AnyRecord } from '../../utils'

export function getPaymentsProductsPlatformData(
    payments: Array<AnyRecord & { id: string }> | undefined,
    platformId: string,
): AnyRecord[] {
    if (!payments) {
        return []
    }

    return payments.map((product) => {
        const platformProduct = (product[platformId] ?? {}) as AnyRecord
        const merged: AnyRecord = { ...platformProduct }
        merged.platformProductId = merged.id ?? product.id
        merged.id = product.id
        return merged
    })
}

export function getPaymentsProductPlatformData(
    payments: Array<AnyRecord & { id: string }> | undefined,
    platformId: string,
    id: string,
): AnyRecord | null {
    if (!payments) {
        return null
    }

    const product = payments.find((p) => p.id === id)
    if (!product) {
        return null
    }

    const platformProduct = (product[platformId] ?? {}) as AnyRecord
    const merged: AnyRecord = { ...platformProduct }
    merged.platformProductId = merged.id ?? product.id
    merged.id = product.id
    return merged
}

export function generatePaymentsTransactionId(id: string): string {
    return `${id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}
