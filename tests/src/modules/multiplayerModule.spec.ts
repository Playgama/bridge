import {
    afterEach, beforeEach, expect, test, vi,
} from 'vitest'
import MultiplayerModule from '../../../src/modules/multiplayer/MultiplayerModule'
import type { MultiplayerBridgeContract } from '../../../src/modules/multiplayer/MultiplayerModule'
import type { MultiplayerSyncOptions } from '../../../src/modules/multiplayer/types'
import type { MultiplayerState } from '../../../src/modules/multiplayer/transport/types'

const runtime = vi.hoisted(() => ({ createRoom: vi.fn(), joinRoom: vi.fn(), joinOrCreateRoom: vi.fn() }))
vi.mock('../../../src/modules/multiplayer/transport/Runtime', () => ({ default: vi.fn(() => runtime) }))
vi.mock('../../../src/lib/bridge-config', () => ({ default: { getValues: () => ({ saas: { publicToken: 'test' } }) } }))

function room() {
    const syncState = vi.fn()
    return {
        syncState,
        inviteCode: 'K1234567',
        players: [],
        hostPlayerId: 'host',
        isHost: true,
        info: { maxPlayers: 2, isOpen: true, isVisible: false, properties: {} },
        onStateChange: vi.fn((callback: (state: MultiplayerState) => void) => {
            expect(syncState).toHaveBeenCalledTimes(1)
            callback({ connectionState: 'connected', syncState: 'ready', isReady: true, isHost: true })
            return vi.fn()
        }),
        onMessage: vi.fn(() => vi.fn()),
        onPlayersChange: vi.fn(() => vi.fn()),
        onRoomChange: vi.fn(() => vi.fn()),
        onError: vi.fn(() => vi.fn()),
        leave: vi.fn().mockResolvedValue(undefined),
    }
}

let multiplayer: MultiplayerModule
beforeEach(() => {
    vi.clearAllMocks()
    multiplayer = new MultiplayerModule().initialize({
        platformId: 'mock', notifyMultiplayerRoomChanged: vi.fn(),
    } as unknown as MultiplayerBridgeContract)
})
afterEach(() => multiplayer.leaveRoom())

test.each(['create', 'invite', 'room id', 'match'])('%s registers game state once before waiting for the host', async (entry) => {
    const handle = room()
    Object.values(runtime).forEach(method => method.mockResolvedValue(handle))
    let world = { score: 7 }
    const syncState: MultiplayerSyncOptions<typeof world> = {
        getState: () => world,
        applyState: state => { world = state },
        updatesPerSecond: 5,
    }

    if (entry === 'create') await multiplayer.createRoom({ syncState })
    else if (entry === 'invite') await multiplayer.joinRoom('K1234567', { syncState })
    else if (entry === 'room id') await multiplayer.joinRoom('12345678-1234-4234-8234-123456789abc', { syncState })
    else await multiplayer.joinOrCreateRoom({ syncState })

    expect(handle.syncState).toHaveBeenCalledTimes(1)
    const registered = handle.syncState.mock.calls[0][0] as typeof syncState
    expect(registered).toBe(syncState)
    expect(registered.getState()).toEqual({ score: 7 })
    registered.applyState({ score: 9 })
    expect(world).toEqual({ score: 9 })
    const admission = entry === 'create' ? runtime.createRoom : entry === 'match' ? runtime.joinOrCreateRoom : runtime.joinRoom
    expect(admission.mock.calls[0][0]).not.toHaveProperty('syncState')
})

test('leaving does not carry game callbacks into a room entered without syncState', async () => {
    const first = room(), second = room()
    runtime.createRoom.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const getState = vi.fn(() => ({ score: 7 }))
    const applyState = vi.fn()
    await multiplayer.createRoom({ syncState: { getState, applyState } })
    multiplayer.leaveRoom()
    await multiplayer.createRoom()

    expect(first.leave).toHaveBeenCalledTimes(1)
    const fallback = second.syncState.mock.calls[0][0] as MultiplayerSyncOptions<object>
    expect(second.syncState).toHaveBeenCalledTimes(1)
    expect(fallback.getState()).toEqual({})
    expect(fallback.updatesPerSecond).toBe(1)
    fallback.applyState({ score: 9 })
    expect(getState).not.toHaveBeenCalled()
    expect(applyState).not.toHaveBeenCalled()
})
