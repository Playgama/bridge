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

import { SAFE_AREA_STYLES_ID } from './constants'
import type { SafeAreaInsets } from './types'

class SafeArea {
    static getInsets(): SafeAreaInsets {
        const div = document.createElement('div')
        div.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);pointer-events:none;visibility:hidden;'
        document.body.appendChild(div)

        const rect = div.getBoundingClientRect()
        const result: SafeAreaInsets = {
            top: rect.top,
            bottom: window.innerHeight - rect.bottom,
            left: rect.left,
            right: window.innerWidth - rect.right,
        }

        div.remove()
        return result
    }

    static applyStyles(): void {
        if (document.getElementById(SAFE_AREA_STYLES_ID)) {
            return
        }

        const style = document.createElement('style')
        style.id = SAFE_AREA_STYLES_ID
        style.textContent = `
            html, body {
                height: calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom));
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                box-sizing: border-box;
            }
        `
        document.head.appendChild(style)
    }
}

export default SafeArea
