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

import './global'
import type PlaygamaBridge from './PlaygamaBridge'

const RUNTIME_MISSING_MESSAGE = 'Playgama Bridge runtime is not loaded. '
    + 'Add the SDK script to index.html before the game script, '
    + 'or add the Vite plugin: import playgamaBridge from \'@playgama/bridge/vite\'. '
    + 'For constants only, import from \'@playgama/bridge/constants\'.'

const readRuntime = (): PlaygamaBridge | undefined => (
    typeof window === 'undefined' ? undefined : window.bridge || window.playgamaBridge
)

const requireRuntime = (): PlaygamaBridge => {
    const runtime = readRuntime()
    if (!runtime) {
        throw new Error(RUNTIME_MISSING_MESSAGE)
    }
    return runtime
}

const deferred = new Proxy({} as PlaygamaBridge, {
    get(_, key) {
        const runtime = requireRuntime()
        const value: unknown = Reflect.get(runtime, key, runtime)
        return typeof value === 'function' ? value.bind(runtime) : value
    },
    set(_, key, value) {
        return Reflect.set(requireRuntime(), key, value)
    },
    has(_, key) {
        const runtime = readRuntime()
        return runtime !== undefined && Reflect.has(runtime, key)
    },
})

const bridge: PlaygamaBridge = readRuntime() || deferred

export default bridge
export { bridge }
export * from './publicConstants'
export type { default as PlaygamaBridge, PlaygamaInitOptions } from './PlaygamaBridge'
