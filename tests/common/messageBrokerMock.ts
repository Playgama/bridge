import { TestGlobalThis } from "./types"

export type MessageListener = (event: { data: unknown }) => void
type MessageCallback = (data: unknown) => unknown

export interface MessageBrokerInterface {
    addListener: (message: string, cb: MessageListener) => void
    removeListener: (message: string, cb: MessageListener) => void
    send: (data: unknown, target?: string) => void
    mockMessageResponse: (moduleName: string, actionName: string, callback: MessageCallback) => void
}

export class MessageBroker {
    private listeners: Map<string, Set<MessageListener>> = new Map()

    constructor(private readonly testGlobalThis: TestGlobalThis) {
        testGlobalThis.addEventListener = (message: string, cb: MessageListener): void => {
            this.addListener(message, cb)
        }
        testGlobalThis.removeEventListener = (message: string, cb: MessageListener): void => {
            this.removeListener(message, cb)
        }
        if (testGlobalThis.parent) {
            testGlobalThis.parent.postMessage = (message: unknown, target: string = '*'): void => {
                this.send(message, target)
            }
        }
    }

    addListener(message: string, cb: MessageListener): void {
        const messageListeners = this.listeners.get(message) || new Set<MessageListener>()
        messageListeners.add(cb)
        this.listeners.set(message, messageListeners)
    }

    removeListener(message: string, cb: MessageListener): void {
        const messageListeners = this.listeners.get(message)
        if (messageListeners) {
            messageListeners.delete(cb)
        }
    }

    send(data: unknown, target: string = '*'): void {
        const messageListeners = this.listeners.get('message')
        if (messageListeners) {
            queueMicrotask(() => {
                messageListeners.forEach((cb) => cb({ data }))
            })
        }
    }

    mockMessageResponse(moduleName: string, actionName: string, callback: MessageCallback): void {
        this.addListener('message', async ({ data }: { data: unknown }) => {
            const messageData = data as { type?: string; action?: string; sender?: string; [key: string]: unknown }
            if (messageData.type === moduleName && messageData.action === actionName && messageData.sender !== 'platform') {
                const result = callback(data)
                this.testGlobalThis.parent.postMessage(result, '*')
            }
        })
    }
}
