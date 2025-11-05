import { MODULE_NAME } from '../../src/constants'
import { ACTION_NAME_QA } from '../../src/platform-bridges/QaToolPlatformBridge'

export class QaToolSdkEmulator {
    static async create(globalThis, messageBroker) {
        const instance = new QaToolSdkEmulator(globalThis, messageBroker)
        await instance.initialize()
        return instance
    }

    constructor(globalThis, messageBroker) {
        this.globalThis = globalThis
        this.messageBroker = messageBroker
    }

    async initialize() {}

    mockFunction (functionName, callback) {
       const mockFunction = this.getMockFunction(functionName)
       if (mockFunction) {
            return mockFunction.call(this, callback)
       }
       
       throw new Error(`Mock function for ${functionName} not found`)
    }

    getMockFunction(functionName) {
        switch (functionName) {
            case 'storage.get':
                return this._getStorageMockFunction
            default:
                return null
        }
    }

    _getStorageMockFunction(callback) {
        this.messageBroker.mockMessageResponse(MODULE_NAME.STORAGE, ACTION_NAME_QA.GET_DATA_FROM_STORAGE, (data) => {
            return {
                type: data.type,
                action: data.action,
                id: data.id,
                storage: callback(data.options.key),
            }
        })
    }

}   