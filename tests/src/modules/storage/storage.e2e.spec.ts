import { describe, test, expect } from 'vitest'
import { createBridgeByPlatformId } from '../../../common/bridge/bridge'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../../src/constants'
import { SUPPORTED_FEATURES } from '../../../../src/platform-bridges/QaToolPlatformBridge'

describe('StorageModule (integration, PlaygamaBridge)', () => {
    // test.each([
    //     PLATFORM_ID.QA_TOOL,
    //     PLATFORM_ID.PLAYGAMA,
    // ])('Check default storage type for platform %s', async (platformId: string) => {
    //     const { bridge } = await createBridgeByPlatformId(platformId)
    //     expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
    // })

    test.each([
        PLATFORM_ID.QA_TOOL
    ])(`Storage.get single key with ${STORAGE_TYPE.LOCAL_STORAGE} for %s platform`, async (platformId: string) => {
        const storageType = STORAGE_TYPE.LOCAL_STORAGE

        const { bridge, mockPlatformAction } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_LOCAL] })
        expect(bridge.storage.isSupported(storageType)).toBe(true)
        expect(bridge.storage.isAvailable(storageType)).toBe(true)

        mockPlatformAction('storage.get', (key: unknown) => ({ [key as string]: 'value_1' }))

        const value = await bridge.storage.get('test', storageType)

        expect(value).toBe('value_1')
    })

    test.each([
        PLATFORM_ID.QA_TOOL
    ])(`Storage.get multiple keys with ${STORAGE_TYPE.LOCAL_STORAGE} for %s platform`, async (platformId: string) => {
        const storageType = STORAGE_TYPE.LOCAL_STORAGE

        const { bridge, mockPlatformAction } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_LOCAL] })
        expect(bridge.storage.isSupported(storageType)).toBe(true)
        expect(bridge.storage.isAvailable(storageType)).toBe(true)

        mockPlatformAction('storage.get', (...args: unknown[]) => {
            const [key1, key2] = args[0] as unknown[]
            return { [key1 as string]: 'value_1', [key2 as string]: 'value_2' }
        })

        const value = await bridge.storage.get(['test', 'test_2'], storageType)

        expect(value).toEqual(['value_1', 'value_2'])
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
        // PLATFORM_ID.PLAYGAMA
    ])(`Cloud Storage should be not available for unauthorized player on %s platform`, async (platformId: string) => {
        const storageType = STORAGE_TYPE.PLATFORM_INTERNAL

        const { bridge, mockPlatformAction } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL] })
        expect(bridge.storage.isSupported(storageType)).toBe(true)
        expect(bridge.storage.isAvailable(storageType)).toBe(false)

        mockPlatformAction('storage.get', (key: unknown) => ({ [key as string]: 'value_1' }))
        const value = bridge.storage.get('test', storageType)

        expect(value).rejects.toBe(undefined)
    })

    test.each([
        PLATFORM_ID.QA_TOOL
    ])(`Cloud Storage should be available for authorized player on %s platform`, async (platformId: string) => {
        const storageType = STORAGE_TYPE.PLATFORM_INTERNAL
        const { bridge, mockPlatformAction } = await createBridgeByPlatformId(platformId, { supportedFeatures: [
            SUPPORTED_FEATURES.PLAYER_AUTHORIZATION,
            SUPPORTED_FEATURES.STORAGE_INTERNAL
        ]})

        mockPlatformAction('player.authorize', () => ({ auth: { status: 'success' }, player: { userId: '123', isAuthorized: true } }))
        await bridge.player.authorize()
        
        expect(bridge.storage.isAvailable(storageType)).toBe(true)

        mockPlatformAction('storage.get', (key: unknown) => ({ [key as string]: 'value_1' }))
        const value = await bridge.storage.get('test', storageType)

        expect(value).toBe('value_1')
    })
})

