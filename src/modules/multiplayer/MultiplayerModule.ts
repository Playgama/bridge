import bridgeConfig from '../../lib/bridge-config'
import type PlatformBridgeBase from '../../platform-bridges/PlatformBridgeBase'
import type MultiplayerRuntime from './Runtime'
import { MultiplayerError } from './types'
import type {
    MultiplayerCreateOptions, MultiplayerJoinOptions, MultiplayerMatchOptions,
    MultiplayerRoom, MultiplayerRoomsQuery, MultiplayerRoomSummary, MultiplayerConfig,
} from './types'

/** Lightweight facade. Runtime and official transport are loaded only by the first operation. */
export default class MultiplayerModule {
    private platform?: PlatformBridgeBase

    private runtime?: Promise<MultiplayerRuntime>

    private config?: MultiplayerConfig

    get isSupported(): boolean {
        return Boolean(this.platform && this.config)
    }

    initialize(platform: PlatformBridgeBase, config?: MultiplayerConfig): void {
        this.platform = platform
        const selected = config || bridgeConfig.getValues().multiplayer
        this.config = selected ? { ...selected } : undefined
    }

    async createRoom(options: MultiplayerCreateOptions): Promise<MultiplayerRoom> {
        return (await this.load()).createRoom(options)
    }

    async joinRoom(options: MultiplayerJoinOptions): Promise<MultiplayerRoom> {
        return (await this.load()).joinRoom(options)
    }

    async joinOrCreateRoom(options: MultiplayerMatchOptions): Promise<MultiplayerRoom> {
        return (await this.load()).joinOrCreateRoom(options)
    }

    async getRooms(query?: MultiplayerRoomsQuery): Promise<{ rooms: MultiplayerRoomSummary[]; nextCursor: string | null }> {
        return (await this.load()).getRooms(query)
    }

    private load(): Promise<MultiplayerRuntime> {
        if (!this.platform) return Promise.reject(new MultiplayerError('NOT_INITIALIZED'))
        const { config } = this
        if (!config) {
            return Promise.reject(new MultiplayerError(
                'MULTIPLAYER_NOT_CONFIGURED',
                'Add multiplayer config to the original bridge.initialize options or local config, then reload the game',
            ))
        }
        if (!this.runtime) {
            this.runtime = import(/* webpackChunkName: "multiplayer" */ './Runtime')
                .then(({ default: Runtime }) => new Runtime(config, () => ({
                    'x-platform-id': this.platform!.platformId,
                    ...(this.platform!.playerId ? { 'x-player-id': this.platform!.playerId! } : {}),
                })))
                .catch((error) => { this.runtime = undefined; throw error })
        }
        return this.runtime
    }
}
