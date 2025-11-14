import { describe, test, expect } from 'vitest'
import { PLATFORM_ID } from '../../../src/constants'
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
        PLATFORM_ID.ABSOLUTE_GAMES
    ])('Initialize by platform_id query parameter %s', async (platformId: string) => {
        const { bridge } = await createBridgeByUrl(`http://localhost/?platform_id=${platformId}`)
        expect(bridge.platform.id).toBe(platformId)
    })
})
