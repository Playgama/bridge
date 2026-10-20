// @vitest-environment node
import { getEventListeners } from 'node:events'
import { it, expect, vi } from 'vitest'
import { Room } from '@colyseus/sdk'
import NativeConnection from '../../src/modules/multiplayer/NativeConnection'

it('settles a stopped handshake and detaches its abort listener even without native JOIN_ROOM', async () => {
    const nativeConnect = vi.spyOn(Room.prototype, 'connect').mockImplementation(function connect(this: Room) {
        this.connection = { close: vi.fn(), isOpen: false } as any
    })
    const abort = new AbortController()
    const native = new NativeConnection({
        control: vi.fn(), syncControl: vi.fn(), relay: vi.fn(), snapshot: vi.fn(), closed: vi.fn(),
    })
    const connecting = native.connect({
        roomId: 'room', playerId: 'player', ownerEpoch: '1', connectionGeneration: '1', region: 'eu',
        expiresAt: '2099-01-01T00:00:00Z',
        colyseus: { name: 'relay', roomId: 'native', processId: 'process', sessionId: 'seat', publicAddress: 'localhost:2567/api/multiplayer/ws' },
    }, 'http://localhost:3300', abort.signal)
    expect(getEventListeners(abort.signal, 'abort')).toHaveLength(1)
    native.stop()
    await expect(connecting).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(getEventListeners(abort.signal, 'abort')).toHaveLength(0)
    nativeConnect.mockRestore()
})
