export function createMessageBroker(window) {
    const listeners = new Map()

    const addListener = (message, cb) => {
        const messageListeners = listeners.get(message) || new Set()
        messageListeners.add(cb)
        listeners.set(message, messageListeners)
    }

    const removeListener = (message, cb) => {
        const messageListeners = listeners.get(message)
        if (messageListeners) {
            messageListeners.delete(cb)
        }
    }

    const send = (data, target = '*') => {
        const messageListeners = listeners.get('message')
        if (messageListeners) {
            // ! Important: we need to use queueMicrotask to ensure that the listeners are called in the correct order
            queueMicrotask(() => {
                messageListeners.forEach((cb) => cb({ data }))
            })
        }
    }

    window.addEventListener = (message, cb) => {
        addListener(message, cb)
    }
    window.removeEventListener = (message, cb) => {
        removeListener(message, cb)
    }
    window.parent.postMessage = (message, target = '*') => {
        send(message, target)
    }

    return {
        addListener,
        removeListener,
        send,
    }
}