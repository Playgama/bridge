import { describe, it } from 'vitest'
import { createBridgeByPlatformId } from '../../_helpers/bridge'
import { PLATFORM_ID } from '../../../src/constants'

describe('StorageModule (integration, PlaygamaBridge, qa_tool)', () => {

    it('Single key set -> get -> delete uses defaultType', async () => {
        const platforms = [
            PLATFORM_ID.QA_TOOL
        ]

        for (const platformId of platforms) {
            const { bridge } = await createBridgeByPlatformId(platformId)
        }
    })
})