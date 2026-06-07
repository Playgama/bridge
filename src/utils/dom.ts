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

const BROWSER_DEFAULTS_PROTECTION_ID = 'bridge-browser-defaults-protection'

export function applyBrowserDefaultsProtection(): void {
    if (document.getElementById(BROWSER_DEFAULTS_PROTECTION_ID)) {
        return
    }

    const style = document.createElement('style')
    style.id = BROWSER_DEFAULTS_PROTECTION_ID
    style.textContent = `
        html, body {
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            overscroll-behavior: contain;
        }
        input, textarea, [contenteditable] {
            -webkit-user-select: text;
            user-select: text;
            -webkit-touch-callout: default;
        }
    `
    document.head.appendChild(style)
    document.addEventListener('contextmenu', (e) => e.preventDefault())
}
