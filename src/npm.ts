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

// npm entry point. Runs the same side-effect as the CDN/<script> build
// (populates window.bridge) and additionally exposes the singleton as a
// typed module export so games can `import bridge from '@playgama/bridge'`.

import './index'
import type PlaygamaBridge from './PlaygamaBridge'

const bridge = window.bridge as PlaygamaBridge

export default bridge
export { bridge }

// Public data-shape types so TypeScript consumers can name the values returned
// by the SDK (e.g. the result of bridge.payments.getCatalog()).
export type { LeaderboardEntry } from './modules/leaderboards'
export type { CatalogProduct, Purchase } from './modules/payments'
export type { ScheduledNotification, NotificationMapping } from './modules/notifications'
