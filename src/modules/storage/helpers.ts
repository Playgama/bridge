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

export function parseValue(raw: unknown, tryParseJson: boolean): unknown {
    if (raw === null || raw === undefined) {
        return null
    }

    if (!tryParseJson || typeof raw !== 'string') {
        return raw
    }

    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

export function serializeValue(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value
    }
    if (typeof value === 'string') {
        return value
    }
    return JSON.stringify(value)
}
