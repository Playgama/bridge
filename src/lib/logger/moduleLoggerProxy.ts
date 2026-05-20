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

import logger from './Logger'
import { LOGGER_IGNORED_MODULE_METHODS } from './constants'

type AnyFunction = (...args: unknown[]) => unknown

function isThenable(value: unknown): value is Promise<unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof (value as { then?: unknown }).then === 'function'
}

/**
 * Wraps a module instance in a Proxy that logs every public method call and
 * its outcome through the shared logger. Property getters are passed through
 * untouched, so only actual method invocations are reported.
 */
export function createModuleLoggerProxy<T extends object>(scope: string, target: T): T {
    const wrappers = new Map<string | symbol, AnyFunction>()

    return new Proxy(target, {
        get(obj, prop) {
            const value = Reflect.get(obj, prop, obj)

            if (typeof value !== 'function') {
                return value
            }

            let wrapper = wrappers.get(prop)
            if (!wrapper) {
                const method = String(prop)
                const original = value as AnyFunction
                const shouldLog = !LOGGER_IGNORED_MODULE_METHODS.includes(method)

                wrapper = (...args: unknown[]): unknown => {
                    if (!shouldLog) {
                        return original.apply(obj, args)
                    }

                    logger.info(`[${scope}] ${method}()`, ...args)
                    const result = original.apply(obj, args)

                    if (isThenable(result)) {
                        result.then(
                            (resolved) => logger.info(`[${scope}] ${method} → resolved`, resolved),
                            (rejected) => logger.warn(`[${scope}] ${method} → rejected`, rejected),
                        )
                    }

                    return result
                }

                wrappers.set(prop, wrapper)
            }

            return wrapper
        },
    })
}
