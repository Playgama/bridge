import { describe, expect, test, vi } from 'vitest'
import { createBridgeByPlatformId } from '../../../common/bridge/bridge'
import type { TestGlobalThis } from '../../../common/types'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../../src/constants'

describe('Playgama anonymous cloud save', () => {
    test('initializes when the guest state cannot be loaded', async () => {
        const result = createBridgeByPlatformId(PLATFORM_ID.PLAYGAMA, {
            playgamaCapabilities: { cloudSaveLoadFails: true },
        })

        await expect(result).resolves.toBeDefined()
    })

    test('keeps an authorized player and reloads before writing after a storage failure', async () => {
        const { bridge } = await createBridgeByPlatformId(PLATFORM_ID.PLAYGAMA, {
            initialPlayerState: { authorized: true, id: 'account-id', name: 'Account' },
            playgamaCapabilities: { cloudSaveLoadFails: true },
        })
        const sdk = (globalThis as unknown as TestGlobalThis).PLAYGAMA_SDK
        if (!sdk) {
            throw new Error('Playgama SDK is not initialized')
        }
        const getState = vi.mocked(sdk.cloudSaveApi.getState)
        const setItems = vi.mocked(sdk.cloudSaveApi.setItems)

        expect(bridge.player.isAuthorized).toBe(true)
        expect(bridge.player.id).toBe('account-id')
        expect(bridge.player.name).toBe('Account')

        getState.mockResolvedValue({ existing: 'cloud' })
        await bridge.storage.set('progress', 'new', STORAGE_TYPE.PLATFORM_INTERNAL)

        expect(setItems).toHaveBeenLastCalledWith({ existing: 'cloud', progress: 'new' })
    })
})
