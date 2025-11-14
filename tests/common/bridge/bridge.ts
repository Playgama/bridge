import { vi } from 'vitest'
import PlaygamaBridge from '../../../src/PlaygamaBridge'
import { createMessageBroker } from '../messageBrokerMock'
import { MODULE_NAME, ACTION_NAME, PLATFORM_ID } from '../../../src/constants'
import { AbsoluteGamesSdkEmulator } from '../absoluteGames/absoluteGames'
import { PlaygamaSdkEmulator } from '../playgama/playgama'
import { QaToolSdkEmulator } from '../qaTool/qaTool'
import { BridgeOptions, CreateBridgeResult, defaultOptions } from './bridge.types'
import type { TestGlobalThis } from '../../common/types'

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
    testGlobal.PLUGIN_VERSION = ' LATEST'

    const mergedOptions = { ...defaultOptions, ...options }
    const messageBroker = createMessageBroker(testGlobal)
    const bridge = new PlaygamaBridge()

    await PlaygamaSdkEmulator.create(testGlobal)
    await AbsoluteGamesSdkEmulator.create(testGlobal)
    const qaToolSdk = await QaToolSdkEmulator.create(testGlobal, messageBroker)

    messageBroker.addListener('message', ({ data }) => {
        const messageData = data as { type?: string; action?: string; sender?: string; [key: string]: unknown }
        if (messageData.type === MODULE_NAME.PLATFORM && messageData.action === ACTION_NAME.INITIALIZE && messageData.source !== 'platform') {
            messageBroker.send({
                source: 'platform',
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME.INITIALIZE,
                supportedFeatures: mergedOptions.supportedFeatures,
            })
        }
    })

    const mockPlatformAction = (functionName: string, callback: (...args: unknown[]) => unknown): void => {
        switch (bridge.platform.id) {
            case PLATFORM_ID.QA_TOOL:
                return qaToolSdk.mockFunction(functionName, callback)
            default:
                throw new Error(`Mock function for platform ${bridge.platform.id} not found`)
        }
    }

    mergedOptions.bridgeOptions = mergedOptions.bridgeOptions || {}
    mergedOptions.bridgeOptions.silent = true
    await bridge.initialize(mergedOptions.bridgeOptions)
    
    return { bridge, messageBroker, mockPlatformAction }
}

export function createBridgeByPlatformId(platformId: string, options: BridgeOptions = {}): Promise<CreateBridgeResult> {
    if (!platformId) {
        throw new Error('platformId is required')
    }

    const testGlobal = globalThis as unknown as TestGlobalThis
    testGlobal.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({
        forciblySetPlatformId: platformId,
    })})

    return createBridge(options)
}

export async function createBridgeByUrl(url: string, options: BridgeOptions = {}): Promise<CreateBridgeResult> {
    if (!url) {
        throw new Error('url is required')
    }
    
    const testGlobal = globalThis as unknown as TestGlobalThis
    testGlobal.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ }) })
    testGlobal.location = { href: url } as unknown as Location

    return createBridge(options)
}
