import { MODULE_NAME } from '../../../src/constants'
import { ACTION_NAME_QA } from '../../../src/platform-bridges/QaToolPlatformBridge'
import { ACTION_NAME } from '../../../src/constants'
import type { MessageBrokerInterface } from '../messageBrokerMock'
import type { TestGlobalThis } from '../../common/types'

type MockFunction = (callback: (...args: unknown[]) => unknown) => void

export class QaToolSdkEmulator {
    static async create(
        testGlobalThis: TestGlobalThis, 
        messageBroker: MessageBrokerInterface
    ): Promise<QaToolSdkEmulator> {
        const instance = new QaToolSdkEmulator(testGlobalThis, messageBroker)
        await instance.initialize()
        return instance
    }

    constructor(
        private readonly testGlobalThis: TestGlobalThis,
        private readonly messageBroker: MessageBrokerInterface
    ) {}

    async initialize(): Promise<void> {}

    // mockState(state: string): void {}

    mockFunction(functionName: string, callback: (...args: unknown[]) => unknown): void {
       const mockFunction = this.getMockFunction(functionName)
       if (mockFunction) {
            return mockFunction.call(this, callback)
       }
       
       throw new Error(`Mock function for ${functionName} not found`)
    }

    private getMockFunction(functionName: string): MockFunction | null {
        switch (functionName) {
            case 'storage.get':
                return this._getStorageMockFunction
            case 'player.authorize':
                return this._getPlayerAuthorizeMockFunction
            default:
                return null
        }
    }

    private _getStorageMockFunction(callback: (...args: unknown[]) => unknown): void {
        this.messageBroker.mockMessageResponse(MODULE_NAME.STORAGE, ACTION_NAME_QA.GET_DATA_FROM_STORAGE, (data) => {
            const messageData = data as { type?: string; action?: string; id?: string; options?: { key?: string | string[] }; [key: string]: unknown }
            return {
                type: messageData.type,
                action: messageData.action,
                id: messageData.id,
                storage: callback(messageData.options?.key),
            }
        })
    }

    private _getPlayerAuthorizeMockFunction(callback: (...args: unknown[]) => unknown): void {
        this.messageBroker.mockMessageResponse(MODULE_NAME.PLAYER, ACTION_NAME.AUTHORIZE_PLAYER, (data) => {
            const messageData = data as { type?: string; action?: string; id?: string; options?: Record<string, unknown>; [key: string]: unknown }
            return {
                type: messageData.type,
                action: messageData.action,
                id: messageData.id,
                ...(callback(messageData.options || {}) as Record<string, unknown>),
            }
        })
    }

    mockState(state: string): void {
        // Implementation for mocking state
        throw new Error(`Mock state for ${state} not implemented`)
    }
}

