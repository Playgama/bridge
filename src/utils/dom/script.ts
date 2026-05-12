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

import type { AnyRecord } from '../object'

interface AdsByGoogleOptions {
    adSenseId: string
    channelId?: string
    hostId?: string
    interstitialPlacementId?: string
    rewardedPlacementId?: string
    adFrequencyHint?: string
    testMode?: boolean
}

type AdsByGooglePush = (adOptions: AnyRecord) => unknown

export const addJavaScript = function addJavaScript(
    src: string,
    options: Record<string, string> = {},
): Promise<Event> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src

        for (let i = 0; i < Object.keys(options).length; i++) {
            const key = Object.keys(options)[i]
            const value = options[key]
            script.setAttribute(key, value)
        }

        script.addEventListener('load', resolve)
        script.addEventListener('error', () => reject(new Error(`Failed to load: ${src}`)))
        document.head.appendChild(script)
    })
}

export const addAdsByGoogle = (
    {
        adSenseId,
        channelId,
        hostId,
        interstitialPlacementId,
        rewardedPlacementId,
        adFrequencyHint = '180s',
        testMode = false,
    }: AdsByGoogleOptions,
    config: AnyRecord = {},
): Promise<AdsByGooglePush> => new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

    script.setAttribute('data-ad-client', adSenseId)

    if (channelId) {
        script.setAttribute('data-ad-channel', channelId)
    } else if (hostId) {
        script.setAttribute('data-ad-host', hostId)
    }

    if (interstitialPlacementId) {
        script.setAttribute('data-admob-interstitial-slot', interstitialPlacementId)
    }

    if (rewardedPlacementId) {
        script.setAttribute('data-admob-rewarded-slot', rewardedPlacementId)
    }

    if (testMode) {
        script.setAttribute('data-adbreak-test', 'on')
    }

    script.setAttribute('data-ad-frequency-hint', adFrequencyHint)
    script.setAttribute('crossorigin', 'anonymous')

    script.addEventListener('load', () => {
        const queue = (window.adsbygoogle ?? []) as unknown[] & {
            push: (config: Record<string, unknown>) => unknown
        }
        window.adsbygoogle = queue
        queue.push({
            preloadAdBreaks: 'on',
            sound: 'on',
            onReady: () => {},
            ...config,
        })

        resolve((adOptions) => queue.push(adOptions))
    })

    script.addEventListener('error', () => {
        reject(new Error('adsbygoogle script failed to load'))
    })
    document.head.appendChild(script)
})
