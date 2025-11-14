import { TestGlobalThis } from "./types"

export type MessageListener = (event: { data: unknown }) => void
type MessageCallback = (data: unknown) => unknown

export interface MessageBrokerInterface {
    addListener: (message: string, cb: MessageListener) => void
    removeListener: (message: string, cb: MessageListener) => void
    send: (data: unknown, target?: string) => void
    mockMessageResponse: (moduleName: string, actionName: string, callback: MessageCallback) => void
}

export function createMessageBroker(testGlobalThis: TestGlobalThis): MessageBrokerInterface {
    const listeners = new Map<string, Set<MessageListener>>()

    const addListener = (message: string, cb: MessageListener): void => {
        const messageListeners = listeners.get(message) || new Set<MessageListener>()
        messageListeners.add(cb)
        listeners.set(message, messageListeners)
    }

    const removeListener = (message: string, cb: MessageListener): void => {
        const messageListeners = listeners.get(message)
        if (messageListeners) {
            messageListeners.delete(cb)
        }
    }

    const send = (data: unknown, target: string = '*'): void => {
        const messageListeners = listeners.get('message')
        if (messageListeners) {
            // ! Important: we need to use queueMicrotask to ensure that the listeners are called in the correct order
            queueMicrotask(() => {
                messageListeners.forEach((cb) => cb({ data }))
            })
        }
    }

    const mockMessageResponse = (moduleName: string, actionName: string, callback: MessageCallback): void => {
        addListener('message', async ({ data }: { data: unknown }) => {
            const messageData = data as { type?: string; action?: string; sender?: string; [key: string]: unknown }
            if (messageData.type === moduleName && messageData.action === actionName && messageData.sender !== 'platform') {
                const result = callback(data)
                send({
                    type: moduleName,
                    action: actionName,
                    sender: 'platform',
                    ...(result as Record<string, unknown>),
                })
            }
        })
    }

    testGlobalThis.addEventListener = (message: string, cb: MessageListener): void => {
        addListener(message, cb)
    }
    testGlobalThis.removeEventListener = (message: string, cb: MessageListener): void => {
        removeListener(message, cb)
    }
    if (testGlobalThis.parent) {
        testGlobalThis.parent.postMessage = (message: unknown, target: string = '*'): void => {
            send(message, target)
        }
    }

    return {
        addListener,
        removeListener,
        send,
        mockMessageResponse
    }
}

