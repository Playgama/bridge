import { vi } from 'vitest'
import PlaygamaBridge from '../../src/PlaygamaBridge'
import { createMessageBroker } from './messageBrokerMock'
import { MODULE_NAME, ACTION_NAME } from '../../src/constants'

const defaultOptions = {
    supportedFeatures: [],
    bridgeOptions: {},
}

async function createBridge(options) {
    globalThis.PLUGIN_VERSION = ' LATEST'

    const mergedOptions = { ...defaultOptions, ...options }
    const messageBroker = createMessageBroker(window)
    const bridge = new PlaygamaBridge()

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

    mergedOptions.bridgeOptions.silent = true
    await bridge.initialize(mergedOptions.bridgeOptions)
    
    return { bridge, messageBroker }
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

