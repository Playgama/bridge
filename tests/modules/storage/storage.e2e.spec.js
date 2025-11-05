import { describe, test, expect } from 'vitest'
import { createBridgeByPlatformId } from '../../_helpers/bridge'
import { PLATFORM_ID } from '../../../src/constants'
import { STORAGE_TYPE } from '../../../src/constants'
import { SUPPORTED_FEATURES } from '../../../src/platform-bridges/QaToolPlatformBridge'

describe('StorageModule (integration, PlaygamaBridge)', () => {
    // test.each([
    //     PLATFORM_ID.QA_TOOL,
    //     PLATFORM_ID.PLAYGAMA,
    // ])('Check default storage type for platform %s', async (platformId) => {
    //     const { bridge } = await createBridgeByPlatformId(platformId)
    //     expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
    // })


    test.each([
        PLATFORM_ID.QA_TOOL,
        // PLATFORM_ID.PLAYGAMA
    ])(`Storage.get single key with ${STORAGE_TYPE.LOCAL_STORAGE} for %s platform`, async (platformId) => {
        const storageType = STORAGE_TYPE.LOCAL_STORAGE

        const { bridge, mockPlatformAction } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_LOCAL] })
        expect(bridge.storage.isSupported(storageType)).toBe(true)
        expect(bridge.storage.isAvailable(storageType)).toBe(true)

        mockPlatformAction('storage.get', (key) => ({ [key]: 'value_1' }))

        const value = await bridge.storage.get('test', storageType)

        expect(value).toBe('value_1')
    })
})