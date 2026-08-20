import type PlaygamaBridge from '../../../src/PlaygamaBridge'
import type { StateManager } from '../stateManager/stateManager'
import type { PlayerState } from '../stateManager/stateManager.types'

export interface BridgeOptions {
    supportedFeatures?: string[]
    bridgeOptions?: Record<string, unknown>
    internalStoragePolicy?: string
    initialPlayerState?: PlayerState
    playgamaCapabilities?: {
        playerAuthorization?: boolean
        cloudSave?: boolean
        cloudSaveLoadFails?: boolean
        payments?: boolean
    }
}

export interface CreateBridgeResult {
    bridge: PlaygamaBridge
    stateManager: StateManager
}

export const defaultOptions: BridgeOptions = {
    supportedFeatures: [],
    bridgeOptions: {},
}
