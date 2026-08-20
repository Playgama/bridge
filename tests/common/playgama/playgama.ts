import { vi } from 'vitest'
import type { TestGlobalThis } from '../../common/types'
import { StateManager } from '../stateManager/stateManager'
import type { PlaygamaPlayer, PlaygamaSdk } from './playgama.types'

export function createPlaygamaSdk(
    testGlobalThis: TestGlobalThis,
    stateManager: StateManager,
    capabilities: {
        playerAuthorization?: boolean
        cloudSave?: boolean
        cloudSaveLoadFails?: boolean
        payments?: boolean
    } = {},
): Promise<void> {

    const userService = {
        getUser(): Promise<PlaygamaPlayer> {
            const player = stateManager.getPlayerState()
            if (player?.authorized) {
                return Promise.resolve({
                    isAuthorized: true,
                    id: player.id,
                    name: player.name ?? '',
                    photos: player.photos ?? [],
                    extra: player.extra ?? {},
                })
            }
            return Promise.reject(new Error('Player not authorized'))
        },

        authorizeUser(): Promise<boolean> {
            const player = stateManager.getPlayerState()
            if (player?.authorized) {
                return Promise.resolve(true)
            }
            return Promise.reject()
        },
    }

    const advService = {
        subscribeToAdStateChanges: vi.fn().mockResolvedValue(Promise.resolve()),
    }

    const cloudSaveApi = {
        getState: capabilities.cloudSaveLoadFails
            ? vi.fn().mockRejectedValue(new Error('Cloud save load failed'))
            : vi.fn().mockResolvedValue({}),
        setItems: vi.fn().mockResolvedValue(Promise.resolve()),
    }


    const platformService = {
        isReady: Promise.resolve(),
        getIsPlayerAuthorizationSupported: vi.fn().mockReturnValue(capabilities.playerAuthorization ?? true),
        getIsCloudSaveSupported: vi.fn().mockReturnValue(capabilities.cloudSave ?? true),
        getIsPaymentsSupported: vi.fn().mockReturnValue(capabilities.payments ?? false),
        getAdditionalParams: vi.fn().mockReturnValue({}),
    }

    const sdk = {
        userService,
        advService,
        cloudSaveApi,
        platformService,
    }

    testGlobalThis.PLAYGAMA_SDK = sdk
    testGlobalThis.PLAYGAMA_WRAP = sdk

    return Promise.resolve()
}
