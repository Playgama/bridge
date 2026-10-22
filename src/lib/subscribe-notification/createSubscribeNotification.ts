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

import { SUBSCRIBE_NOTIFICATION_TYPE, type SubscribeNotificationType } from './constants'
import rollVariant from './rollVariant'
import bounceVariant from './bounceVariant'

// Shows the animated hint pointing at the YouTube subscribe button below the game.
// Returns the container so the caller can remove it once the game is ready.
function createSubscribeNotification(
    type: SubscribeNotificationType = SUBSCRIBE_NOTIFICATION_TYPE.ROLL,
): HTMLDivElement {
    const variant = type === SUBSCRIBE_NOTIFICATION_TYPE.BOUNCE ? bounceVariant : rollVariant

    if (!document.getElementById(variant.stylesId)) {
        const style = document.createElement('style')
        style.id = variant.stylesId
        style.textContent = variant.styles
        document.head.appendChild(style)
    }

    const container = document.createElement('div')
    container.id = variant.id
    container.innerHTML = variant.markup

    document.body.appendChild(container)
    return container
}

export default createSubscribeNotification
