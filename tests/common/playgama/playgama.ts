import { vi } from 'vitest'
import type { TestGlobalThis } from '../../common/types'
import { StateManager } from '../stateManager/stateManager'
import type { PlaygamaPlayer, PlaygamaSdk } from './playgama.types'

export function createPlaygamaSdk(
    testGlobalThis: TestGlobalThis, 
    stateManager: StateManager
): Promise<void> {

    const userService = {
        getUser(): Promise<PlaygamaPlayer> {
            const player = stateManager.getPlayerState()
            if (player?.authorized) {
                return Promise.resolve({
                    authorized: true,
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
        getState: vi.fn().mockResolvedValue(Promise.resolve({})),
        setItems: vi.fn().mockResolvedValue(Promise.resolve()),
    }


    testGlobalThis.PLAYGAMA_SDK = {
        userService,
        advService,
        cloudSaveApi,
    }

    return Promise.resolve()
}
