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

export const isBase64Image = function isBase64Image(str: string): boolean {
    const base64ImageRegex = /^data:image\/(png|jpeg|jpg|gif|bmp|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/
    return base64ImageRegex.test(str)
}

export function deformatPrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[^\d.,-]/g, '')

    if (cleaned.includes('.') && cleaned.includes(',') && cleaned.indexOf(',') < cleaned.indexOf('.')) {
        return parseFloat(cleaned.replace(/,/g, ''))
    }

    if (cleaned.includes('.') && cleaned.includes(',') && cleaned.indexOf(',') > cleaned.indexOf('.')) {
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
    }

    if (cleaned.includes(',')
        && cleaned.lastIndexOf(',') !== -1
        && cleaned.lastIndexOf(',') === cleaned.length - 4) {
        return parseInt(cleaned.replace(/,/, ''), 10)
    }

    if (cleaned.includes(',')
        && cleaned.lastIndexOf(',') !== -1
        && cleaned.lastIndexOf(',') !== cleaned.length - 3) {
        return parseFloat(cleaned.replace(',', '.'))
    }

    if (cleaned.includes('.')
        && cleaned.lastIndexOf('.') !== -1
        && cleaned.lastIndexOf('.') === cleaned.length - 4) {
        return parseInt(cleaned.replace(/\./, ''), 10)
    }

    if (cleaned.includes('.')) {
        return parseFloat(cleaned)
    }

    return parseInt(cleaned, 10)
}
