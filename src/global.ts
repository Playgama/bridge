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

// Types the global `bridge` singleton for projects that load the SDK via a
// <script> tag (CDN or a local copy) instead of importing it. Reaches
// consumers through the npm/constants entry points, or explicitly via
// `import type {} from '@playgama/bridge/global'`.

import type PlaygamaBridge from './PlaygamaBridge'

declare global {
    /* eslint-disable no-var, vars-on-top */
    var bridge: PlaygamaBridge
    var playgamaBridge: PlaygamaBridge
    /* eslint-enable no-var, vars-on-top */
}

export {}
