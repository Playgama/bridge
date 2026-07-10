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

import type { AnyRecord } from './object'

export const waitFor = function waitFor(...args: string[]): Promise<void> {
    if (args.length <= 0) {
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            let parent: AnyRecord = window as unknown as AnyRecord

            for (let i = 0; i < args.length; i++) {
                const currentObject = parent[args[i]]
                if (!currentObject) {
                    return
                }

                parent = currentObject as AnyRecord
            }

            resolve()
            clearInterval(checkInterval)
        }, 100)
    })
}
