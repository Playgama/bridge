import { STORAGE_TYPE } from '../../../src/constants'
import type { PlayerState, StorageStateType } from './stateManager.types'

export class StateManager {
    private storageData: Map<StorageStateType, Map<string, string>> = new Map([
        [STORAGE_TYPE.LOCAL_STORAGE, new Map()],
        [STORAGE_TYPE.PLATFORM_INTERNAL, new Map()],
    ])
    private playerState: PlayerState | null = null

    setPlayerState(state: PlayerState): void {
        this.playerState = state
    }

    getPlayerState(): PlayerState | null {
        return this.playerState
    }

    setStorageKey(storageType: StorageStateType, key: string, value: string): void {
        const storageMap = this.storageData.get(storageType)
        if (!storageMap) {
            throw new Error(`Invalid storage type: ${storageType}`)
        }
        storageMap.set(key, value)
    }

    getStorageKey(storageType: StorageStateType, key: string): string | undefined {
        const storageMap = this.storageData.get(storageType)
        if (!storageMap) {
            throw new Error(`Invalid storage type: ${storageType}`)
        }
    
        return storageMap.get(key) || undefined
    }
}

