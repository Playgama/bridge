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

// Catalog product. Only `id` is guaranteed on every platform. Price fields are
// present on most, but their exact type/naming varies per platform (e.g. `price`
// may be a display string or a numeric amount), so they are optional and the
// index signature keeps platform-specific extras accessible without pretending
// the shape is uniform.
export interface CatalogProduct {
    id: string
    price?: string | number
    priceValue?: number
    priceCurrencyCode?: string
    [key: string]: unknown
}

// Purchase / receipt. `id` is the only field guaranteed across platforms; the
// rest are raw platform receipt fields spread onto the object, hence the open
// index signature.
export interface Purchase {
    id: string
    [key: string]: unknown
}
