import { describe, it, expect, vi, beforeEach } from 'vitest'
import MultiplayerModule from '../../src/modules/multiplayer/MultiplayerModule'
import bridgeConfig from '../../src/lib/bridge-config'
import type PlatformBridgeBase from '../../src/platform-bridges/PlatformBridgeBase'

const calls = vi.hoisted(() => ({ constructed: vi.fn(), enter: vi.fn().mockResolvedValue({ id: 'room' }) }))
vi.mock('../../src/modules/multiplayer/Runtime', () => ({
    default: class {
        constructor(...args: unknown[]) { calls.constructed(...args) }
        createRoom = calls.enter
        joinRoom = calls.enter
        joinOrCreateRoom = calls.enter
        getRooms = calls.enter
    },
}))

const platform = { platformId: 'standalone', playerId: null } as unknown as PlatformBridgeBase
const config = { apiBase: 'http://localhost:3300/api/bridge/v1/relay', appToken: 'public', environment: 'test' }

beforeEach(() => { vi.clearAllMocks() })

describe('experimental module opt-in and lazy loading', () => {
    it('preserves explicit initialize opt-in even when an existing config file loads successfully', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '{"game":{"id":"existing"}}' }))
        await bridgeConfig.load('/config.json', { multiplayer: config })
        bridgeConfig.initialize('standalone')
        // Existing Bridge options are fallbacks, so pass this feature's explicit opt-in separately.
        expect(bridgeConfig.getValues().multiplayer).toBeUndefined()
        const module = new MultiplayerModule()
        module.initialize(platform, config)
        expect(module.isSupported).toBe(true)
        expect(calls.constructed).not.toHaveBeenCalled()
        await module.createRoom({ player: { name: 'A' } })
        expect(calls.constructed.mock.calls[0][0]).toEqual(config)
        vi.unstubAllGlobals()
    })

    it('uses local file opt-in and rejects absent configuration before loading the runtime', async () => {
        vi.spyOn(bridgeConfig, 'getValues').mockReturnValue({})
        const missing = new MultiplayerModule()
        missing.initialize(platform)
        await expect(missing.getRooms()).rejects.toMatchObject({ code: 'MULTIPLAYER_NOT_CONFIGURED' })
        expect(calls.constructed).not.toHaveBeenCalled()
        vi.mocked(bridgeConfig.getValues).mockReturnValue({ multiplayer: config })
        const configured = new MultiplayerModule()
        configured.initialize(platform)
        await configured.getRooms()
        expect(calls.constructed).toHaveBeenCalledTimes(1)
        vi.restoreAllMocks()
    })

    it('shares the lazy runtime load across simultaneous operations', async () => {
        const module = new MultiplayerModule()
        module.initialize(platform, config)
        await Promise.all([
            module.createRoom({ player: { name: 'A' } }),
            module.joinOrCreateRoom({ player: { name: 'A' } }),
        ])
        expect(calls.constructed).toHaveBeenCalledTimes(1)
    })
})
