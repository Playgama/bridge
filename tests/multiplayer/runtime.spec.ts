// @vitest-environment node
import { it, expect, vi } from 'vitest'
import Runtime from '../../src/modules/multiplayer/Runtime'

const fake = vi.hoisted(() => ({
    session: { region: 'eu' },
    request: vi.fn(),
    connects: 0,
}))
vi.mock('../../src/modules/multiplayer/HttpClient', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../src/modules/multiplayer/HttpClient')>(),
    default: class {
        async session() { return fake.session }
        request = fake.request
    },
    delay: async () => {},
}))
vi.mock('../../src/modules/multiplayer/RoomHandle', () => ({
    default: class {
        id = 'room'
        inviteCode = 'K7M4X9TR'
        async connect() { fake.connects += 1; await Promise.resolve() }
        abandon() {}
    },
}))

it('coalesces concurrent code/room ID/matching admissions into one stable handle', async () => {
    fake.connects = 0
    fake.request.mockReset().mockResolvedValue({ status: 'grant', reservation: { roomId: 'room' } })
    const runtime = new Runtime({ apiBase: 'http://localhost:3300', appToken: 'public', environment: 'test' }, () => ({}))
    const [code, id, matching] = await Promise.all([
        runtime.joinRoom({ code: 'K7M4X9TR', player: { name: 'A' } }),
        runtime.joinRoom({ roomId: 'room', player: { name: 'A' } }),
        runtime.joinOrCreateRoom({ player: { name: 'A' } }),
    ])
    expect(code).toBe(id)
    expect(id).toBe(matching)
    expect(fake.connects).toBe(1)
    expect(fake.request).toHaveBeenCalledTimes(2)
})
