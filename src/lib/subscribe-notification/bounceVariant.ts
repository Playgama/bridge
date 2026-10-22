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
    SUBSCRIBE_NOTIFICATION_BOUNCE_ID,
    SUBSCRIBE_NOTIFICATION_BOUNCE_STYLES_ID,
} from './constants'
import type { SubscribeNotificationVariant } from './types'

// A shine runs over the button and the ball, then the button gets pressed with
// a ripple and keeps gently hopping. Motion uses only translate/scale/opacity,
// so the browser animates it on the GPU without relayouts.
const bounceVariant: SubscribeNotificationVariant = {
    id: SUBSCRIBE_NOTIFICATION_BOUNCE_ID,
    stylesId: SUBSCRIBE_NOTIFICATION_BOUNCE_STYLES_ID,
    styles: `
        /* Shine position in screen coordinates. It is animated on the container and
           inherited, so the shine runs over the button and the ball without a break */
        @property --bridge-yt-shine-x {
            syntax: '<length>';
            inherits: true;
            initial-value: -160px;
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} {
            position: fixed;
            inset: 0;
            pointer-events: none;
            transform-origin: 134.4px calc(100% - 56px);
            z-index: 9999999;
            animation:
                bridge-yt-bounce-shine 4200ms cubic-bezier(0.45, 0, 0.35, 1) 1100ms infinite,
                bridge-yt-bounce-press 760ms 1980ms forwards,
                bridge-yt-bounce-hop 3200ms ease-in-out 2850ms infinite;
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-button,
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-ball {
            position: fixed;
            bottom: 24px;
            height: 64px;
            background-color: #45C9F2;
            box-shadow: inset 0 0 17.06px 0 rgba(0, 148, 207, 0.3), inset 0 0 16px 0 rgba(181, 239, 255, 0.65);
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-button {
            --left: 24px;
            left: 24px;
            width: 220.8px;
            border-radius: 107.8px;
            padding: 11.2px 25.6px 12.8px 25.6px;
            white-space: nowrap;
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-ball {
            --left: 248px;
            left: 248px;
            width: 64px;
            border-radius: 50%;
        }

        /* Darkens the button while it is pressed */
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-button::before,
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-ball::before {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.14);
            opacity: 0;
            animation: bridge-yt-bounce-press-shade 760ms ease-in-out 1980ms forwards;
        }

        /* Shine: a wide soft halo with a narrow bright stroke in the middle.
           0.966 and 8.28px compensate the 105deg gradient angle */
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-button::after,
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-ball::after {
            content: '';
            position: absolute;
            inset: 0;
            --x: calc((var(--bridge-yt-shine-x) - var(--left)) * 0.966 + 8.28px);
            background: linear-gradient(105deg,
                rgba(255, 255, 255, 0) calc(var(--x) - 64px),
                rgba(255, 255, 255, 0.12) calc(var(--x) - 36px),
                rgba(255, 255, 255, 0.35) calc(var(--x) - 9.6px),
                rgba(255, 255, 255, 0.9) calc(var(--x) - 1.6px),
                rgba(255, 255, 255, 0.9) calc(var(--x) + 1.6px),
                rgba(255, 255, 255, 0.35) calc(var(--x) + 9.6px),
                rgba(255, 255, 255, 0.12) calc(var(--x) + 24px),
                rgba(255, 255, 255, 0) calc(var(--x) + 44px));
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-title {
            font-family: "Arial Rounded MT Bold", "Trebuchet MS", Verdana, sans-serif;
            font-weight: 700;
            font-size: 34.4px;
            line-height: 100%;
            letter-spacing: -0.035em;
            color: #102B3C;
        }

        /* Ripple from the press point, starts when the button is pushed in (1980 + 30% of 760ms) */
        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-ripple {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 32px;
            height: 32px;
            margin: -16px 0 0 -16px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            transform: scale(0);
            opacity: 0;
            animation: bridge-yt-bounce-ripple 600ms cubic-bezier(0.2, 0.6, 0.3, 1) 2208ms forwards;
        }

        #${SUBSCRIBE_NOTIFICATION_BOUNCE_ID} .bridge-yt-arrow {
            position: absolute;
            width: 25.6px;
            height: 25.6px;
        }

        @keyframes bridge-yt-bounce-shine {
            0% { --bridge-yt-shine-x: -80px; }
            17%, 100% { --bridge-yt-shine-x: 384px; }
        }

        /* Slight wind-up, quick push in, short hold, springy release with fading oscillation */
        @keyframes bridge-yt-bounce-press {
            0%   { transform: scale(1) translateY(0);          animation-timing-function: cubic-bezier(0.3, 0, 0.4, 1); }
            14%  { transform: scale(1.03) translateY(-1.6px);  animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.6); }
            30%  { transform: scale(0.9) translateY(2.4px);    animation-timing-function: linear; }
            42%  { transform: scale(0.905) translateY(2.4px);  animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); }
            60%  { transform: scale(1.04) translateY(-0.8px);  animation-timing-function: ease-in-out; }
            74%  { transform: scale(0.985) translateY(0);      animation-timing-function: ease-in-out; }
            87%  { transform: scale(1.006) translateY(0);      animation-timing-function: ease-in-out; }
            100% { transform: scale(1) translateY(0); }
        }

        @keyframes bridge-yt-bounce-press-shade {
            0%, 14%   { opacity: 0; }
            30%, 42%  { opacity: 1; }
            60%, 100% { opacity: 0; }
        }

        @keyframes bridge-yt-bounce-ripple {
            from { transform: scale(0); opacity: 0.5; }
            to   { transform: scale(9); opacity: 0; }
        }

        /* A small recurring hop with a soft landing and a quiet pause */
        @keyframes bridge-yt-bounce-hop {
            0%, 8%, 40%, 100% { translate: 0 0; }
            18% { translate: 0 -8px; animation-timing-function: ease-in; }
            27% { translate: 0 0; animation-timing-function: ease-out; }
            33% { translate: 0 -2.4px; animation-timing-function: ease-in; }
        }
    `,
    markup: `
        <div class="bridge-yt-button">
            <span class="bridge-yt-ripple"></span>
            <span class="bridge-yt-title">Subscribe</span>
        </div>
        <div class="bridge-yt-ball">
            <svg class="bridge-yt-arrow" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24.6532 13.488L28.7812 17.184L16.1572 30.288L3.5332 17.184L7.7092 13.488L13.2772 19.392L13.1332 0H19.1812L19.0372 19.488L24.6532 13.488Z" fill="#102B3C"/>
            </svg>
        </div>
    `,
}

export default bounceVariant
