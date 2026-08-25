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

// Typing for the singletons the bundle attaches to `window`. Lives in a real
// module (not in the ambient `globals.d.ts`) because `tsc` copies declarations
// only for compiled modules: the npm package needs this file in `dist/types`,
// otherwise `import '@playgama/bridge/global'` resolves to nothing.

import type PlaygamaBridge from './PlaygamaBridge'

declare global {
    interface Window {
        bridge?: PlaygamaBridge
        playgamaBridge?: PlaygamaBridge
    }
}

export {}
