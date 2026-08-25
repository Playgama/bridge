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

// Entry point of the npm package: `import { bridge } from '@playgama/bridge'`.
//
// The instance is not created here. `./index` attaches exactly one singleton to
// `window`, and a game that also loads the standalone `playgama-bridge.js` must
// end up talking to that same instance — two bridges on one page means two
// initializations and two sets of platform listeners.

import './index'
import './global'
import type PlaygamaBridge from './PlaygamaBridge'

const bridge = window.bridge as PlaygamaBridge

export default bridge
export { bridge }
export * from './publicConstants'
export type { default as PlaygamaBridge } from './PlaygamaBridge'
export type { PlaygamaInitOptions } from './PlaygamaBridge'
