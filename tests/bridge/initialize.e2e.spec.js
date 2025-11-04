import { describe, it, expect } from 'vitest'
import { PLATFORM_ID } from '../../src/constants'
import { createBridgeByPlatformId, createBridgeByUrl } from '../_helpers/bridge'

describe('initialize (integration, PlaygamaBridge)', () => {
    it('Inintialize by forciblySetPlatformId', async () => {
        const platforms = [
            PLATFORM_ID.MOCK,
            PLATFORM_ID.QA_TOOL
        ]
        for (const platformId of platforms) {
            const { bridge } = await createBridgeByPlatformId(platformId)
            expect(bridge.platform.id).toBe(platformId)
        }
    })


    it(`Initialize by platform_id query parameter`, async () => {
        const platforms = [
            PLATFORM_ID.MOCK,
            PLATFORM_ID.QA_TOOL
        ]

        for (const platformId of platforms) {
            const { bridge } = await createBridgeByUrl(`http://localhost/?platform_id=${platformId}`)
            expect(bridge.platform.id).toBe(platformId)
        }
    })
})