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

    const mockMessageResponse = (moduleName, actionName, callback) => {
        addListener('message', async ({ data }) => {
            if (data.type === moduleName && data.action === actionName && data.sender !== 'platform') {
                const result = callback(data)
                send({
                    type: moduleName,
                    action: actionName,
                    sender: 'platform',
                    ...result,
                })
            }
        })
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
        mockMessageResponse
    }
}