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

const NO_WINDOW_MESSAGE = 'Playgama Bridge runs in a browser only, and there is no window in this environment. '
    + 'On a server, in a worker or in tests, import from \'@playgama/bridge/constants\' instead: '
    + 'it carries the constants and the types with no runtime.'

const RUNTIME_MISSING_MESSAGE = 'Playgama Bridge runtime is not loaded. '
    + 'Add <script src="playgama-bridge.js"></script> to index.html before the game script, '
    + 'or add the Vite plugin: import playgamaBridge from \'@playgama/bridge/vite\'. '
    + 'For constants only, import from \'@playgama/bridge/constants\'.'

if (typeof window === 'undefined') {
    throw new Error(NO_WINDOW_MESSAGE)
}

const runtime = (window.bridge || window.playgamaBridge) as PlaygamaBridge | undefined

if (!runtime) {
    throw new Error(RUNTIME_MISSING_MESSAGE)
}

const bridge: PlaygamaBridge = runtime

export default bridge
export { bridge }
export * from './publicConstants'
export type { default as PlaygamaBridge, PlaygamaInitOptions } from './PlaygamaBridge'
