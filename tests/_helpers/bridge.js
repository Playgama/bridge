import { vi } from 'vitest'
import PlaygamaBridge from '../../src/PlaygamaBridge'
import { createMessageBroker } from './messageBrokerMock'
import { MODULE_NAME, ACTION_NAME, PLATFORM_ID } from '../../src/constants'
import { AbsoluteGamesSdkEmulator } from '../_emulators/absoluteGames'
import { PlaygamaSdkEmulator } from '../_emulators/playgama'
import { QaToolSdkEmulator } from '../_emulators/qaTool'
    
const defaultOptions = {
    supportedFeatures: [],
    bridgeOptions: {},
}

// mock function addJavaScript from src/common/utils.js
vi.mock('../../src/common/utils', async (importOriginal) => ({
    ...(await importOriginal()),
    addJavaScript: vi.fn().mockResolvedValue(Promise.resolve()),
}))

async function createBridge(options) {
    globalThis.PLUGIN_VERSION = ' LATEST'

    const mergedOptions = { ...defaultOptions, ...options }
    const messageBroker = createMessageBroker(window)
    const bridge = new PlaygamaBridge()

    await PlaygamaSdkEmulator.create(globalThis)
    await AbsoluteGamesSdkEmulator.create(globalThis)
    const qaToolSdk = await QaToolSdkEmulator.create(globalThis, messageBroker)

    messageBroker.addListener('message', ({ data }) => {
        if (data.type === MODULE_NAME.PLATFORM && data.action === ACTION_NAME.INITIALIZE && data.sender !== 'platform') {
            messageBroker.send({
                type: MODULE_NAME.PLATFORM,
                action: ACTION_NAME.INITIALIZE,
                supportedFeatures: mergedOptions.supportedFeatures,
                sender: 'platform',
            })
        }
    })


    const mockPlatformAction = (functionName, callback) => {
        switch (bridge.platform.id) {
            case PLATFORM_ID.QA_TOOL:
                return qaToolSdk.mockFunction(functionName, callback)
            default:
                throw new Error(`Mock function for platform ${bridge.platform.id} not found`)
        }
    }


    mergedOptions.bridgeOptions.silent = true
    await bridge.initialize(mergedOptions.bridgeOptions)
    
    return { bridge, messageBroker, mockPlatformAction }
}

export function createBridgeByPlatformId(platformId, options = {}) {
    if (!platformId) {
        throw new Error('platformId is required')
    }

    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({
        forciblySetPlatformId: platformId,
    })})

    return createBridge(options)
}

export async function createBridgeByUrl(url, options = {}) {
    if (!url) {
        throw new Error('url is required')
    }
    
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ }) })
    window.location = { href: url }

    return createBridge(options)
}

