import { describe, test, expect } from 'vitest'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../../src/constants'
import { createBridgeByPlatformId } from '../../../common/bridge/bridge'
import { INTERNAL_STORAGE_POLICY, SUPPORTED_FEATURES } from '../../../../src/platform-bridges/QaToolPlatformBridge'

describe('Internal Storage Policy (integration, QaToolPlatform)', () => {
    test('Check default storage type when internal storage policy is not set', async () => {
        const { bridge, stateManager } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
            supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL, SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
        })
        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(false)

        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(true)
    })


    test('Check default storage type when internal storage policy is never', async () => {
        const { bridge, stateManager } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
            supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL, SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
            internalStoragePolicy: INTERNAL_STORAGE_POLICY.NEVER 
        })
        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(false)

        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(false)
    })

    test('Check default storage type when internal storage policy is authorized only', async () => {
        const { bridge, stateManager } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
            supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL, SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
            internalStoragePolicy: INTERNAL_STORAGE_POLICY.AUTHORIZED_ONLY 
        })
        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(false)
        
        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(true)
    })

    test('Check default storage type when internal storage policy is always', async () => {
        const { bridge, stateManager } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
            supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL, SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
            internalStoragePolicy: INTERNAL_STORAGE_POLICY.ALWAYS 
        })
        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(true)

        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
        expect(bridge.storage.isAvailable(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(true)
    })
})
