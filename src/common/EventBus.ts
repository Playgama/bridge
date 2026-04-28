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

import type { EventEmitter, EventListener } from '../types/common'

type EventListenerWithOriginal = EventListener & { _original?: EventListener }

interface LocalEventTarget {
    _eventListeners?: Record<string, EventListenerWithOriginal[]>
}

type LocalEmitter = LocalEventTarget & EventEmitter

export function applyLocalEventMixin(target: object): void {
    /* eslint-disable no-param-reassign */
    const t = target as LocalEmitter

    t.on = function on(this: LocalEmitter, eventName: string, callback: EventListener): void {
        if (!this._eventListeners) {
            this._eventListeners = {}
        }
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = []
        }
        this._eventListeners[eventName].push(callback)
    }

    t.off = function off(this: LocalEmitter, eventName: string, callback?: EventListener): void {
        if (!this._eventListeners?.[eventName]) {
            return
        }

        if (!callback) {
            delete this._eventListeners[eventName]
            return
        }

        this._eventListeners[eventName] = this._eventListeners[eventName].filter(
            (cb) => cb !== callback && cb._original !== callback,
        )
    }

    t.once = function once(this: LocalEmitter, eventName: string, callback: EventListener): void {
        const wrapper = ((...args: unknown[]): void => {
            this.off(eventName, wrapper)
            callback(...args)
        }) as EventListenerWithOriginal
        wrapper._original = callback
        this.on(eventName, wrapper)
    }

    t.emit = function emit(this: LocalEmitter, eventName: string, ...args: unknown[]): void {
        if (!this._eventListeners?.[eventName]) {
            return
        }

        const listeners = [...this._eventListeners[eventName]]
        listeners.forEach((cb) => {
            try {
                cb(...args)
            } catch (e) {
                console.error(`[EventBus] Listener error on "${eventName}":`, e)
            }
        })
    }
    /* eslint-enable no-param-reassign */
}

const eventBus = {} as EventEmitter
applyLocalEventMixin(eventBus)

export function applyEventBusMixin(target: object): void {
    /* eslint-disable no-param-reassign */
    const t = target as Pick<EventEmitter, 'on' | 'off' | 'once'>

    t.on = function on(eventName: string, callback: EventListener): void {
        eventBus.on(eventName, callback)
    }
    t.off = function off(eventName: string, callback?: EventListener): void {
        eventBus.off(eventName, callback)
    }
    t.once = function once(eventName: string, callback: EventListener): void {
        eventBus.once(eventName, callback)
    }
    /* eslint-enable no-param-reassign */
}

export default eventBus
