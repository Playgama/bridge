import type PlaygamaBridge from '../../../src/PlaygamaBridge'
import type { MessageBrokerInterface } from '../messageBrokerMock'

export interface BridgeOptions {
    supportedFeatures?: string[]
    bridgeOptions?: Record<string, unknown>
}

export interface CreateBridgeResult {
    bridge: PlaygamaBridge
    messageBroker: MessageBrokerInterface
    mockPlatformAction: (functionName: string, callback: (...args: unknown[]) => unknown) => void
}

export const defaultOptions: BridgeOptions = {
    supportedFeatures: [],
    bridgeOptions: {},
}