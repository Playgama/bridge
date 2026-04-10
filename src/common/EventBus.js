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

export function applyLocalEventMixin(target) {
    /* eslint-disable no-param-reassign */
    target.on = function on(eventName, callback) {
        if (!this._eventListeners) {
            this._eventListeners = {}
        }
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = []
        }
        this._eventListeners[eventName].push(callback)
    }

    target.off = function off(eventName, callback) {
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

    target.once = function once(eventName, callback) {
        const wrapper = (...args) => {
            this.off(eventName, wrapper)
            callback(...args)
        }
        wrapper._original = callback
        this.on(eventName, wrapper)
    }

    target.emit = function emit(eventName, ...args) {
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

const eventBus = {}
applyLocalEventMixin(eventBus)

export function applyEventBusMixin(target) {
    /* eslint-disable no-param-reassign */
    target.on = function on(eventName, callback) {
        eventBus.on(eventName, callback)
    }
    target.off = function off(eventName, callback) {
        eventBus.off(eventName, callback)
    }
    target.once = function once(eventName, callback) {
        eventBus.once(eventName, callback)
    }
    /* eslint-enable no-param-reassign */
}

export default eventBus
