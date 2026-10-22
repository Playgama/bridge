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

import PlatformBridgeBase from './PlatformBridgeBase'
import logger from '../lib/logger'
import { EVENT_NAME } from '../constants'
import { PLATFORM_ID, PLATFORM_MESSAGE, type PlatformId } from '../modules/platform/constants'
import { DEVICE_TYPE, type DeviceType } from '../modules/device/constants'
import {
    getGowChannel,
    GOW_COMMAND,
    GOW_DEDICATED_ACTION,
    GOW_STATE,
    type GowCommandMessage,
    type GowDedicatedAction,
    type GowState,
} from '../lib/gow'
import type { AnyRecord } from '../utils'

const MESSAGE_STATES: Record<string, GowState> = {
    [PLATFORM_MESSAGE.GAME_READY]: GOW_STATE.READY,
    [PLATFORM_MESSAGE.GAMEPLAY_STARTED]: GOW_STATE.PLAYING,
    [PLATFORM_MESSAGE.LEVEL_STARTED]: GOW_STATE.PLAYING,
    [PLATFORM_MESSAGE.LEVEL_RESUMED]: GOW_STATE.PLAYING,
    [PLATFORM_MESSAGE.LEVEL_PAUSED]: GOW_STATE.PAUSED,
    [PLATFORM_MESSAGE.LEVEL_COMPLETED]: GOW_STATE.LEVEL_COMPLETE,
    [PLATFORM_MESSAGE.LEVEL_FAILED]: GOW_STATE.GAME_OVER,
}

const CUSTOM_STATES: GowState[] = [
    GOW_STATE.LOADING,
    GOW_STATE.READY,
    GOW_STATE.PLAYING,
    GOW_STATE.PAUSED,
    GOW_STATE.HOME,
    GOW_STATE.MENU,
    GOW_STATE.GAME_OVER,
    GOW_STATE.LEVEL_COMPLETE,
]

const EVENT_STATES: GowState[] = [
    GOW_STATE.EXIT_REQUESTED,
    GOW_STATE.EXITING,
]

const ROUND_END_STATES: GowState[] = [
    GOW_STATE.GAME_OVER,
    GOW_STATE.LEVEL_COMPLETE,
]

const GENERIC_ERROR_CODE = 'ERR_GENERIC_ERROR'
const DEFAULT_ERROR_CODE = 'ERR_GAME_ERROR'
const ERROR_CODE_PATTERN = /^ERR_[A-Z0-9_]+$/

const KNOWN_RESOLUTIONS = ['SD', 'HD', 'FHD', 'FULL_HD', 'FULL_HD_2K', '2K', 'QHD', 'UHD', '4K']

const GAMEPAD_BUTTON = {
    L1: 4,
    R1: 5,
}

class GowPlatformBridge extends PlatformBridgeBase {
    get platformId(): PlatformId {
        return PLATFORM_ID.GOW
    }

    get isPlatformExternalCallsSupported(): boolean {
        return false
    }

    get isPlatformExternalLinksAllowed(): boolean {
        return false
    }

    get isPlatformPageVisibilityApiAllowed(): boolean {
        return false
    }

    get deviceType(): DeviceType {
        return DEVICE_TYPE.DESKTOP
    }

    #state: GowState = GOW_STATE.LOADING

    #lastNonErrorState: GowState = GOW_STATE.LOADING

    #stateBeforeLoading: GowState | null = null

    #lastPostedState: GowState | null = null

    #error: AnyRecord | null = null

    #isCommandPaused = false

    #isUserPaused = false

    #isCommandMuted = false

    #isUserMuted = false

    #pressedGamepadButtons = new Set<string>()

    #isGamepadPolling = false

    initialize(): Promise<unknown> {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        this._data = this.#readRuntimeConfig()
        this.on(EVENT_NAME.PAUSE_STATE_CHANGED, () => this.#publishState())

        const pending = getGowChannel().attachCommands((message) => this.#onCommand(message))

        if (this._options?.dedicatedControls !== false) {
            getGowChannel().attachDedicatedControls((action) => this.#onDedicatedControl(action))
            window.addEventListener('gamepadconnected', () => this.#startGamepadPolling())
        }

        this._isInitialized = true
        this.#publishState()

        this.#isCommandPaused = pending.isPaused
        this.#isCommandMuted = pending.isMuted
        this.#applyPauseState()
        this.#applyAudioState()

        return Promise.resolve()
    }

    sendMessage(message?: unknown, options?: unknown): Promise<unknown> {
        switch (message) {
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED: {
                if (this.#state !== GOW_STATE.LOADING) {
                    this.#stateBeforeLoading = this.#state === GOW_STATE.ERROR ? this.#lastNonErrorState : this.#state
                    this.#setState(GOW_STATE.LOADING)
                }
                break
            }
            case PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED: {
                if (this.#state === GOW_STATE.LOADING && this.#stateBeforeLoading) {
                    this.#setState(this.#stateBeforeLoading)
                }
                this.#stateBeforeLoading = null
                break
            }
            case PLATFORM_MESSAGE.GAMEPLAY_STOPPED: {
                if (this.#state === GOW_STATE.PLAYING || this.#state === GOW_STATE.PAUSED) {
                    this.#setState(GOW_STATE.MENU)
                }
                break
            }
            default: {
                const state = MESSAGE_STATES[message as string]
                if (state) {
                    this.#stateBeforeLoading = null
                    this.#setState(state)
                }

                if (message === PLATFORM_MESSAGE.GAME_READY) {
                    this.#redeliverPlatformState()
                }
            }
        }

        return super.sendMessage(message, options)
    }

    sendCustomMessage(id?: unknown, options?: unknown): Promise<unknown> {
        if (id === GOW_STATE.ERROR) {
            this.#error = this.#createError(options)
            this.#setState(GOW_STATE.ERROR, true)
            return Promise.resolve()
        }

        if (EVENT_STATES.includes(id as GowState)) {
            this.#postEvent(id as GowState)
            return Promise.resolve()
        }

        if (CUSTOM_STATES.includes(id as GowState)) {
            this.#setState(id as GowState)
            return Promise.resolve()
        }

        return super.sendCustomMessage(id, options)
    }

    getServerTime(): Promise<number> {
        return Promise.resolve(Date.now())
    }

    checkAdBlock(): Promise<boolean> {
        return Promise.resolve(false)
    }

    #onCommand(message: GowCommandMessage): void {
        switch (message.command) {
            case GOW_COMMAND.PAUSE: {
                this.#isCommandPaused = true
                this.#applyPauseState()
                break
            }
            case GOW_COMMAND.CONTINUE: {
                this.#isCommandPaused = false
                this.#isUserPaused = false
                this.#applyPauseState()
                break
            }
            case GOW_COMMAND.MUTE: {
                this.#isCommandMuted = true
                this.#applyAudioState()
                break
            }
            case GOW_COMMAND.UNMUTE: {
                this.#isCommandMuted = false
                this.#applyAudioState()
                break
            }
            default: {
                this.#publishState(true)
            }
        }

        getGowChannel().postAck(message)
    }

    #onDedicatedControl(action: GowDedicatedAction): void {
        if (action === GOW_DEDICATED_ACTION.PAUSE) {
            if (this.#isCommandPaused) {
                return
            }

            this.#isUserPaused = !this.#isUserPaused
            this.#applyPauseState()
            return
        }

        if (this.#isCommandMuted) {
            return
        }

        this.#isUserMuted = !this.#isUserMuted
        this.#applyAudioState()
    }

    #setState(state: GowState, force = false): void {
        if (state === GOW_STATE.PLAYING && this.#isUserPaused) {
            this.#isUserPaused = false
            this.#state = state
            this.#applyPauseState()
        }

        if (state !== GOW_STATE.ERROR) {
            this.#error = null
            this.#lastNonErrorState = state
        }

        this.#state = state
        this.#publishState(force || (ROUND_END_STATES.includes(state) && !this.isPlatformPaused))
    }

    #publishState(force = false): void {
        const state = this.isPlatformPaused && this.#state !== GOW_STATE.ERROR
            ? GOW_STATE.PAUSED
            : this.#state

        if (!force && state === this.#lastPostedState) {
            return
        }

        this.#lastPostedState = state
        getGowChannel().postState(state, state === GOW_STATE.ERROR ? this.#error : null)
    }

    #postEvent(state: GowState): void {
        this.#lastPostedState = state
        getGowChannel().postState(state)
    }

    #redeliverPlatformState(): void {
        if (this.isPlatformPaused) {
            this.emit(EVENT_NAME.PAUSE_STATE_CHANGED, true)
        }

        if (!this.isPlatformAudioEnabled) {
            this.emit(EVENT_NAME.AUDIO_STATE_CHANGED, false)
        }
    }

    #applyPauseState(): void {
        this._setPauseState(this.#isCommandPaused || this.#isUserPaused)
    }

    #applyAudioState(): void {
        this._setAudioState(!(this.#isCommandMuted || this.#isUserMuted))
    }

    #startGamepadPolling(): void {
        if (this.#isGamepadPolling || typeof navigator.getGamepads !== 'function') {
            return
        }

        this.#isGamepadPolling = true

        const poll = (): void => {
            const gamepads = Array.from(navigator.getGamepads())
                .filter((gamepad): gamepad is Gamepad => gamepad !== null)

            if (gamepads.length === 0) {
                this.#isGamepadPolling = false
                this.#pressedGamepadButtons.clear()
                return
            }

            gamepads.forEach((gamepad) => {
                this.#handleGamepadButton(gamepad, GAMEPAD_BUTTON.R1, GOW_DEDICATED_ACTION.PAUSE)
                this.#handleGamepadButton(gamepad, GAMEPAD_BUTTON.L1, GOW_DEDICATED_ACTION.MUTE)
            })

            requestAnimationFrame(poll)
        }

        requestAnimationFrame(poll)
    }

    #handleGamepadButton(gamepad: Gamepad, buttonIndex: number, action: GowDedicatedAction): void {
        const key = `${gamepad.index}:${buttonIndex}`
        const isPressed = gamepad.buttons[buttonIndex]?.pressed === true
        const wasPressed = this.#pressedGamepadButtons.has(key)

        if (isPressed && !wasPressed) {
            this.#pressedGamepadButtons.add(key)
            this.#onDedicatedControl(action)
        } else if (!isPressed && wasPressed) {
            this.#pressedGamepadButtons.delete(key)
        }
    }

    #createError(options: unknown): AnyRecord {
        const parsed = typeof options === 'string' ? this.#parseJson(options) : options
        const source = parsed && typeof parsed === 'object' ? parsed as AnyRecord : {}

        const requestedCode = typeof source.code === 'string' && ERROR_CODE_PATTERN.test(source.code)
            ? source.code
            : null
        const message = typeof source.message === 'string' && source.message.trim() !== ''
            ? source.message
            : null

        let code = requestedCode ?? DEFAULT_ERROR_CODE
        if (code === GENERIC_ERROR_CODE && !message) {
            code = DEFAULT_ERROR_CODE
        }

        if (code !== requestedCode) {
            logger.warn(`GoW error code "${String(source.code)}" is missing, invalid or lacks a message, sending ${code}`)
        }

        const error: AnyRecord = {
            code,
            recoverable: source.recoverable === true,
        }

        if (code === GENERIC_ERROR_CODE) {
            error.message = message
        }

        return error
    }

    #readRuntimeConfig(): AnyRecord {
        const params = new URL(window.location.href).searchParams
        const values: AnyRecord = {}

        const encodedConfig = params.get('gameConfig')
        if (encodedConfig) {
            const decodedConfig = this.#parseLooseJson(this.#decodeBase64(encodedConfig) ?? encodedConfig)
            if (decodedConfig && typeof decodedConfig === 'object') {
                Object.assign(values, decodedConfig)
            }
        }

        const targetFps = params.get('targetFPS')
        if (targetFps) {
            values.targetFPS = /^\d+(\.\d+)?$/.test(targetFps) ? targetFps : this.#decodeValue(targetFps)
        }

        const resolution = params.get('resolution')
        if (resolution) {
            values.resolution = KNOWN_RESOLUTIONS.includes(resolution.toUpperCase())
                ? resolution
                : this.#decodeValue(resolution)
        }

        const debug = params.get('debug')
        if (debug) {
            values.debug = ['true', 'false', '1', '0'].includes(debug) ? debug : this.#decodeValue(debug)
        }

        const data: AnyRecord = {}

        const targetFpsValue = Number(values.targetFPS)
        if (Number.isFinite(targetFpsValue) && targetFpsValue > 0) {
            data.targetFPS = targetFpsValue
        }

        if (typeof values.resolution === 'string' && values.resolution !== '') {
            data.resolution = values.resolution
        }

        const debugValue = this.#parseBoolean(values.debug)
        if (debugValue !== null) {
            data.debug = debugValue
            logger.enabled = debugValue
        }

        return data
    }

    #decodeValue(raw: string): string {
        const decoded = this.#decodeBase64(raw)
        if (decoded === null || decoded === '') {
            return raw
        }

        const isPrintable = Array.from(decoded).every((char) => {
            const code = char.charCodeAt(0)
            return code >= 32 && code !== 127
        })

        return isPrintable ? decoded.trim() : raw
    }

    #decodeBase64(value: string): string | null {
        const normalized = value.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/')
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)

        try {
            const binary = atob(padded)
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        } catch {
            return null
        }
    }

    #parseLooseJson(value: string): unknown {
        const strict = this.#parseJson(value)
        if (strict !== null) {
            return strict
        }

        const normalized = value
            .replace(/[“”„″]/g, '"')
            .replace(/:\s*([A-Za-z_][A-Za-z0-9_]*)\s*([,}])/g, (match, word: string, end: string) => (
                ['true', 'false', 'null'].includes(word) ? match : `: "${word}"${end}`
            ))

        return this.#parseJson(normalized)
    }

    #parseJson(value: string): unknown {
        try {
            return JSON.parse(value)
        } catch {
            return null
        }
    }

    #parseBoolean(value: unknown): boolean | null {
        if (value === true || value === 'true' || value === '1') {
            return true
        }

        if (value === false || value === 'false' || value === '0') {
            return false
        }

        return null
    }
}

export default GowPlatformBridge
