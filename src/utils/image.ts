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

import { isBase64Image } from './string'

// Normalizes a canonical `image` value to a base64 data-URI. A game-supplied
// screenshot already is one and passes through untouched; an URL coming from the
// config is fetched and encoded so bridges that require base64 (e.g. Facebook)
// can use either source. The hosted image must be CORS-accessible.
export function toBase64Image(image: string): Promise<string> {
    if (isBase64Image(image)) {
        return Promise.resolve(image)
    }

    return fetch(image)
        .then((response) => response.blob())
        .then((blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
        }))
}
