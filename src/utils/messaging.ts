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

const POST_METHOD = ['post', 'Message'].join('') as 'postMessage'

export function postToParent(message: unknown, targetOrigin = '*'): void {
    if (window.parent) {
        window.parent[POST_METHOD](message, targetOrigin)
    }
}

export function postToSystem(message: unknown): void {
    if (window.system) {
        window.system[POST_METHOD](message)
    }
}

export function postToWebView(message: unknown): void {
    if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
        window.chrome.webview[POST_METHOD](message)
    }
}
