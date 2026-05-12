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

import {
    ADVANCED_BANNER_CONTAINER_ID_PREFIX,
    BANNER_CONTAINER_ID,
    BANNER_POSITION,
    type BannerPosition,
} from '../../modules/advertisement/constants'

export interface AdvancedBannerConfig {
    width?: string
    height?: string
    top?: string
    bottom?: string
    left?: string
    right?: string
}

export function createAdvertisementBannerContainer(position: BannerPosition): HTMLDivElement {
    const container = document.createElement('div')
    container.id = BANNER_CONTAINER_ID
    container.style.position = 'absolute'
    document.body.appendChild(container)

    switch (position) {
        case BANNER_POSITION.TOP:
            container.style.top = '0px'
            container.style.height = '90px'
            container.style.width = '100%'
            break
        case BANNER_POSITION.BOTTOM:
        default:
            container.style.bottom = '0px'
            container.style.height = '90px'
            container.style.width = '100%'
            break
    }

    return container
}

export function createAdvancedBannerContainers(banners: AdvancedBannerConfig[]): string[] {
    const containerIds: string[] = []

    banners.forEach((banner, index) => {
        const container = document.createElement('div')
        const id = `${ADVANCED_BANNER_CONTAINER_ID_PREFIX}${index}`
        container.id = id
        container.style.position = 'absolute'
        container.style.zIndex = '9999'

        if (banner.width) container.style.width = banner.width
        if (banner.height) container.style.height = banner.height
        if (banner.top) container.style.top = banner.top
        if (banner.bottom) container.style.bottom = banner.bottom
        if (banner.left) container.style.left = banner.left
        if (banner.right) container.style.right = banner.right

        document.body.appendChild(container)
        containerIds.push(id)
    })

    return containerIds
}

export function removeAdvancedBannerContainers(): void {
    const containers = document.querySelectorAll(`[id^="${ADVANCED_BANNER_CONTAINER_ID_PREFIX}"]`)
    containers.forEach((container) => container.remove())
}

export function createAdContainer(containerId: string): HTMLDivElement {
    const container = document.createElement('div')
    container.id = containerId
    container.style.position = 'fixed'
    container.style.inset = '0'
    container.style.zIndex = '9999999'
    document.body.appendChild(container)

    return container
}
