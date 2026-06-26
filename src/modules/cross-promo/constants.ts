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

export const STYLE_ID = 'bridge-cross-promo-styles'
export const CONTAINER_ID = 'bridge-cross-promo'
export const DEFAULT_TITLE = 'More games'
export const GAMES_PER_SHOW = 4
export const ICON_ASPECT_RATIO = '183 / 256'

export const CROSS_PROMO_SOURCE = {
    CONFIG: 'config',
    PLATFORM: 'platform',
} as const
export type CrossPromoSource = typeof CROSS_PROMO_SOURCE[keyof typeof CROSS_PROMO_SOURCE]

export const STYLES = `
    #${CONTAINER_ID} {
        position: fixed;
        inset: 0;
        z-index: 9999998;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.72);
        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        animation: bridge-cp-fade-in 180ms ease-out;
        padding: 16px;
        box-sizing: border-box;
    }

    #${CONTAINER_ID} .bridge-cp-modal {
        position: relative;
        width: 100%;
        max-width: 640px;
        max-height: 100%;
        background: #212121;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #ffffff;
    }

    #${CONTAINER_ID} .bridge-cp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
    }

    #${CONTAINER_ID} .bridge-cp-title {
        margin: 0;
        color: #ffffff;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.2px;
    }

    #${CONTAINER_ID} .bridge-cp-close {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #aaaaaa;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 200ms ease, color 200ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
    }

    #${CONTAINER_ID} .bridge-cp-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        overflow-y: auto;
        padding: 4px;
        margin: -4px;
        -webkit-overflow-scrolling: touch;
    }

    #${CONTAINER_ID} .bridge-cp-tile {
        display: flex;
        flex-direction: column;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
    }

    #${CONTAINER_ID} .bridge-cp-thumb {
        position: relative;
        width: 100%;
        aspect-ratio: ${ICON_ASPECT_RATIO};
        border-radius: 12px;
        overflow: hidden;
        background: #333333 center/cover no-repeat;
        transition: transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 250ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-tile:hover .bridge-cp-thumb {
        transform: translateY(-4px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    }

    #${CONTAINER_ID} .bridge-cp-name {
        margin-top: 8px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        color: #f1f1f1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 200ms ease;
    }

    #${CONTAINER_ID} .bridge-cp-tile:hover .bridge-cp-name {
        color: #3ea6ff;
    }

    @keyframes bridge-cp-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @media (min-width: 600px) {
        #${CONTAINER_ID} .bridge-cp-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    }
`
