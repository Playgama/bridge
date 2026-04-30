import {
    describe, test, expect, beforeEach,
} from 'vitest'
import { createBridgeByPlatformId } from '../../../common/bridge/bridge'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../../src/constants'
import { SUPPORTED_FEATURES } from '../../../../src/platform-bridges/QaToolPlatformBridge'

describe('StorageModule (integration, PlaygamaBridge)', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
    ])(`Storage.get single key with ${STORAGE_TYPE.LOCAL_STORAGE} for %s platform`, async (platformId: string) => {
        const { bridge } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_LOCAL] })

        window.localStorage.setItem('test', 'value_1')

        const value = await bridge.storage.get('test')

        expect(value).toBe('value_1')
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
    ])(`Storage.get multiple keys with ${STORAGE_TYPE.LOCAL_STORAGE} for %s platform`, async (platformId: string) => {
        const { bridge } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_LOCAL] })

        window.localStorage.setItem('test', 'value_1')
        window.localStorage.setItem('test_2', 'value_2')

        const value = await bridge.storage.get(['test', 'test_2'])

        expect(value).toEqual(['value_1', 'value_2'])
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
    ])(`Storage.get falls back to localStorage when cloud is not ready on %s platform`, async (platformId: string) => {
        const { bridge } = await createBridgeByPlatformId(platformId, { supportedFeatures: [SUPPORTED_FEATURES.STORAGE_INTERNAL] })

        window.localStorage.setItem('test', 'value_1')

        const value = await bridge.storage.get('test')

        expect(value).toBe('value_1')
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
    ])(`Default storage type should be changed to ${STORAGE_TYPE.PLATFORM_INTERNAL} on %s platform`, async (platformId: string) => {
        const { bridge, stateManager } = await createBridgeByPlatformId(platformId, { supportedFeatures: [
            SUPPORTED_FEATURES.PLAYER_AUTHORIZATION,
            SUPPORTED_FEATURES.STORAGE_INTERNAL,
            SUPPORTED_FEATURES.STORAGE_LOCAL,
        ] })

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)

        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.PLATFORM_INTERNAL)
    })

    test.each([
        PLATFORM_ID.QA_TOOL,
    ])(`Cloud Storage should be available for authorized player on %s platform`, async (platformId: string) => {
        const { bridge, stateManager } = await createBridgeByPlatformId(platformId, { supportedFeatures: [
            SUPPORTED_FEATURES.PLAYER_AUTHORIZATION,
            SUPPORTED_FEATURES.STORAGE_INTERNAL,
        ] })

        stateManager.setPlayerState({ authorized: true, id: '123' })
        await bridge.player.authorize()

        stateManager.setStorageKey(STORAGE_TYPE.PLATFORM_INTERNAL, 'test', 'value_1')
        const value = await bridge.storage.get('test')

        expect(value).toBe('value_1')
    })
})
