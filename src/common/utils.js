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

export const addJavaScript = function addJavaScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.addEventListener('load', resolve)
        document.head.appendChild(script)
    })
}

export const addAdsByGoogle = ({
    hostId, adsenseId, channelId, adFrequencyHint = '180s',
}) => new Promise((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('data-ad-client', adsenseId)

    if (channelId) {
        script.setAttribute('data-ad-channel', channelId)
    } else if (hostId) {
        script.setAttribute('data-ad-host', hostId)
    }

    script.setAttribute('data-ad-frequency-hint', adFrequencyHint)
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

    script.addEventListener('load', resolve)
    document.head.appendChild(script)
})

export const waitFor = function waitFor(...args) {
    if (args.length <= 0) {
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            let parent = window

            for (let i = 0; i < args.length; i++) {
                const currentObject = parent[args[i]]
                if (!currentObject) {
                    return
                }

                parent = currentObject
            }

            resolve()
            clearInterval(checkInterval)
        }, 100)
    })
}
