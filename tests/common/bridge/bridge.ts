import { vi } from 'vitest'
import PlaygamaBridge from '../../../src/PlaygamaBridge'
import { MessageBroker } from '../messageBrokerMock'
import { MODULE_NAME, ACTION_NAME, PLATFORM_ID } from '../../../src/constants'
import { AbsoluteGamesSdkEmulator } from '../absoluteGames/absoluteGames'
import { createPlaygamaSdk } from '../playgama/playgama'
import { createQaToolSdk } from '../qaTool/qaTool'
import { BridgeOptions, CreateBridgeResult, defaultOptions } from './bridge.types'
import type { TestGlobalThis } from '../../common/types'
import { StateManager } from '../stateManager/stateManager'

// mock function addJavaScript from src/common/utils.js
vi.mock('../../../src/common/utils', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>
    return {
        ...original,
        addJavaScript: vi.fn().mockResolvedValue(Promise.resolve()),
    }
})

async function createBridge(options: BridgeOptions = {}): Promise<CreateBridgeResult> {
    const testGlobal = globalThis as unknown as TestGlobalThis

    testGlobal.PLUGIN_VERSION = 'LATEST'
    testGlobal.console.info = vi.fn().mockImplementation(() => {})

    const mergedOptions = { ...defaultOptions, ...options }
    const messageBroker = new MessageBroker(testGlobal)
    const stateManager = new StateManager()
    const bridge = new PlaygamaBridge()

    await createPlaygamaSdk(testGlobal, stateManager)
    await createQaToolSdk(testGlobal, stateManager)
    await AbsoluteGamesSdkEmulator.create(testGlobal)

    messageBroker.addListener('message', ({ data }) => {
        const messageData = data as { type?: string; action?: string; sender?: string; [key: string]: unknown }
        if (messageData.type === MODULE_NAME.PLATFORM && messageData.action === ACTION_NAME.INITIALIZE && messageData.source !== 'platform') {
            messageBroker.send({
                source: 'platform',
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME.INITIALIZE,
                supportedFeatures: mergedOptions.supportedFeatures,
                config: {
                    internalStoragePolicy: mergedOptions.internalStoragePolicy,
                },
            }, '*')
        }
    })

    // const mockPlatformAction = (functionName: string, callback: (...args: unknown[]) => unknown): void => {
    //     switch (bridge.platform.id) {
    //         case PLATFORM_ID.QA_TOOL:
    //             return qaToolSdk.mockFunction(functionName, callback)
    //         default:
    //             throw new Error(`Mock function for platform ${bridge.platform.id} not found`)
    //     }
    // }

    mergedOptions.bridgeOptions = mergedOptions.bridgeOptions || {}
    await bridge.initialize(mergedOptions.bridgeOptions)
    
    return { bridge, stateManager }
}

export function createBridgeByPlatformId(platformId: string, options: BridgeOptions = {}): Promise<CreateBridgeResult> {
    if (!platformId) {
        throw new Error('platformId is required')
    }

    const testGlobal = globalThis as unknown as TestGlobalThis
    testGlobal.fetch = vi.fn().mockResolvedValue({ 
        ok: true,
        text: () => Promise.resolve(`{ "forciblySetPlatformId": "${platformId}" }`)
    })

    return createBridge(options)
}

export async function createBridgeByUrl(url: string, options: BridgeOptions = {}): Promise<CreateBridgeResult> {
    if (!url) {
        throw new Error('url is required')
    }
    
    const testGlobal = globalThis as unknown as TestGlobalThis
    testGlobal.fetch = vi.fn().mockResolvedValue({ 
        ok: true,
        text: () => Promise.resolve(`{}`),
    })
    testGlobal.location = { href: url } as unknown as Location

    return createBridge(options)
}
