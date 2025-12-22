import type PlaygamaBridge from '../../../src/PlaygamaBridge'
import type { StateManager } from '../stateManager/stateManager'

export interface BridgeOptions {
    supportedFeatures?: string[]
    bridgeOptions?: Record<string, unknown>
    internalStoragePolicy?: string
}

export interface CreateBridgeResult {
    bridge: PlaygamaBridge
    stateManager: StateManager
}

export const defaultOptions: BridgeOptions = {
    supportedFeatures: [],
    bridgeOptions: {},
}