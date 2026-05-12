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

export type AnyRecord = Record<string, unknown>

export const getKeyOrNull = <T extends AnyRecord, K extends keyof T>(
    obj: T,
    key: K,
): T[K] | null => (obj[key] === undefined ? null : obj[key])

export function getKeysFromObject(
    keys: string | string[],
    data: AnyRecord,
    tryParseJson = false,
): unknown {
    if (Array.isArray(keys)) {
        return keys.reduce<unknown[]>((res, key, i) => {
            res[i] = getKeyOrNull(data, key)
            if (tryParseJson) {
                try {
                    res[i] = JSON.parse(res[i] as string)
                } catch {
                    // keep value as is
                }
            }
            return res
        }, new Array(keys.length))
    }

    let value: unknown = getKeyOrNull(data, keys)
    if (tryParseJson && typeof value === 'string') {
        try {
            value = JSON.parse(value)
        } catch {
            // keep value as is
        }
    }
    return value
}

export function deepMerge<A extends AnyRecord, B extends AnyRecord>(
    firstObject: A,
    secondObject: B,
): A & B {
    const result: AnyRecord = { ...firstObject }
    const keys = Object.keys(secondObject)

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const firstValue = (firstObject as AnyRecord)[key]
        const secondValue = (secondObject as AnyRecord)[key]
        if (
            key in firstObject
            && secondValue instanceof Object
            && firstValue instanceof Object
        ) {
            result[key] = deepMerge(firstValue as AnyRecord, secondValue as AnyRecord)
        } else {
            result[key] = secondValue
        }
    }

    return result as A & B
}
