import { describe, test, expect } from 'vitest'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../src/constants'
import { createBridgeByPlatformId, createBridgeByUrl } from '../../common/bridge/bridge'

describe('initialize (integration, PlaygamaBridge)', () => {
    test.each([
        PLATFORM_ID.MOCK,
        PLATFORM_ID.QA_TOOL
    ])('Inintialize by forciblySetPlatformId %s', async (platformId: string) => {
        const { bridge } = await createBridgeByPlatformId(platformId)
        expect(bridge.platform.id).toBe(platformId)
    })

    test.each([
        PLATFORM_ID.MOCK,
        PLATFORM_ID.QA_TOOL,
        PLATFORM_ID.PLAYGAMA,
        PLATFORM_ID.STANDALONE,
        PLATFORM_ID.ABSOLUTE_GAMES
    ])('Initialize by platform_id query parameter %s', async (platformId: string) => {
        const { bridge } = await createBridgeByUrl(`http://localhost/?platform_id=${platformId}`)
        expect(bridge.platform.id).toBe(platformId)
    })

    test('Initialize standalone by platform_id query parameter', async () => {
        const { bridge } = await createBridgeByUrl(`http://localhost/?platform_id=${PLATFORM_ID.STANDALONE}`)
        expect(bridge.platform.id).toBe(PLATFORM_ID.STANDALONE)
    })

    test('Initialize standalone with optional host services disabled', async () => {
        const { bridge } = await createBridgeByUrl(
            `http://localhost/?platform_id=${PLATFORM_ID.STANDALONE}`,
            {
                playgamaCapabilities: {
                    playerAuthorization: false,
                    cloudSave: false,
                    payments: false,
                },
            },
        )

        expect(bridge.player.isAuthorizationSupported).toBe(false)
        expect(bridge.storage.isSupported(STORAGE_TYPE.PLATFORM_INTERNAL)).toBe(false)
        expect(bridge.storage.defaultType).toBe(STORAGE_TYPE.LOCAL_STORAGE)
        expect(bridge.payments.isSupported).toBe(false)
    })
})
