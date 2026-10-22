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

import { postToParent, type AnyRecord } from '../../utils'
import {
    GOW_COMMAND,
    GOW_DEDICATED_ACTION,
    GOW_MESSAGE_TYPE,
    GOW_PROTOCOL_VERSION,
    GOW_STATE,
    type GowCommand,
    type GowCommandMessage,
    type GowDedicatedAction,
    type GowPendingCommands,
    type GowState,
} from './constants'

type CommandHandler = (message: GowCommandMessage) => void
type DedicatedControlHandler = (action: GowDedicatedAction) => void

const REQUEST_ID_KEYS = ['request_id', 'requestId', ' request_id']

const DEDICATED_KEYS: Array<{ code: string, key: string, action: GowDedicatedAction }> = [
    { code: 'KeyP', key: 'p', action: GOW_DEDICATED_ACTION.PAUSE },
    { code: 'KeyM', key: 'm', action: GOW_DEDICATED_ACTION.MUTE },
]

class GowChannel {
    #isStarted = false

    #commandHandler: CommandHandler | null = null

    #dedicatedControlHandler: DedicatedControlHandler | null = null

    #pending: GowPendingCommands = { isPaused: false, isMuted: false }

    start(): void {
        if (this.#isStarted) {
            return
        }

        this.#isStarted = true
        window.addEventListener('message', (event) => this.#onMessage(event))
        window.addEventListener('keydown', (event) => this.#onKey(event), true)
        window.addEventListener('keyup', (event) => this.#onKey(event), true)
    }

    attachCommands(handler: CommandHandler): GowPendingCommands {
        this.start()
        this.#commandHandler = handler
        return { ...this.#pending }
    }

    attachDedicatedControls(handler: DedicatedControlHandler): void {
        this.start()
        this.#dedicatedControlHandler = handler
    }

    postAck(message: GowCommandMessage): void {
        postToParent({
            type: GOW_MESSAGE_TYPE.ACK,
            version: GOW_PROTOCOL_VERSION,
            request_id: message.requestId,
            command: message.command,
            status: 'success',
        })
    }

    postState(state: GowState, error: AnyRecord | null = null): void {
        const message: AnyRecord = {
            type: GOW_MESSAGE_TYPE.STATE,
            version: GOW_PROTOCOL_VERSION,
            state,
            timestamp: new Date().toISOString(),
        }

        if (error) {
            message.error = error
        }

        postToParent(message)
    }

    #onMessage(event: MessageEvent): void {
        const message = this.#parseCommand(event.data)
        if (!message) {
            return
        }

        if (this.#commandHandler) {
            this.#commandHandler(message)
            return
        }

        switch (message.command) {
            case GOW_COMMAND.PAUSE: {
                this.#pending.isPaused = true
                break
            }
            case GOW_COMMAND.CONTINUE: {
                this.#pending.isPaused = false
                break
            }
            case GOW_COMMAND.MUTE: {
                this.#pending.isMuted = true
                break
            }
            case GOW_COMMAND.UNMUTE: {
                this.#pending.isMuted = false
                break
            }
            default: {
                this.postState(GOW_STATE.LOADING)
            }
        }

        this.postAck(message)
    }

    #onKey(event: KeyboardEvent): void {
        if (!this.#dedicatedControlHandler || event.ctrlKey || event.altKey || event.metaKey) {
            return
        }

        if (this.#isEditableTarget(event.target)) {
            return
        }

        const dedicatedKey = DEDICATED_KEYS.find(({ code, key }) => (event.code
            ? event.code === code
            : typeof event.key === 'string' && event.key.toLowerCase() === key))

        if (!dedicatedKey) {
            return
        }

        event.preventDefault()
        event.stopImmediatePropagation()

        if (event.type === 'keydown' && !event.repeat) {
            this.#dedicatedControlHandler(dedicatedKey.action)
        }
    }

    #isEditableTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) {
            return false
        }

        return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    }

    #parseCommand(raw: unknown): GowCommandMessage | null {
        if (typeof raw === 'string' && !raw.includes(GOW_MESSAGE_TYPE.COMMAND)) {
            return null
        }

        const data = typeof raw === 'string' ? this.#parseJson(raw) : raw
        if (!data || typeof data !== 'object') {
            return null
        }

        const { type, version, command } = data as AnyRecord
        if (type !== GOW_MESSAGE_TYPE.COMMAND) {
            return null
        }

        const [majorVersion] = GOW_PROTOCOL_VERSION.split('.')
        if ((typeof version !== 'string' && typeof version !== 'number') || String(version).split('.')[0] !== majorVersion) {
            return null
        }

        const requestIdKey = REQUEST_ID_KEYS.find((key) => key in (data as AnyRecord))
        const requestId = requestIdKey ? (data as AnyRecord)[requestIdKey] : undefined
        if ((typeof requestId !== 'string' && typeof requestId !== 'number') || requestId === '') {
            return null
        }

        if (!Object.values(GOW_COMMAND).includes(command as GowCommand)) {
            return null
        }

        return { requestId, command: command as GowCommand }
    }

    #parseJson(value: string): unknown {
        try {
            return JSON.parse(value)
        } catch {
            return null
        }
    }
}

export default GowChannel
