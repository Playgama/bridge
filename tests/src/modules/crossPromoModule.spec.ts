import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import CrossPromoModule from '../../../src/modules/cross-promo/CrossPromoModule'
import bridgeConfig from '../../../src/lib/bridge-config'
import { EVENT_NAME } from '../../../src/constants'
import { CONTAINER_ID } from '../../../src/modules/cross-promo/constants'
import type { CrossPromoBridgeContract, CrossPromoConfig } from '../../../src/modules/cross-promo/types'

vi.mock('../../../src/lib/bridge-config', () => ({
    default: {
        getValues: vi.fn(() => ({})),
    },
}))

function mockConfig(crossPromo?: CrossPromoConfig) {
    vi.mocked(bridgeConfig.getValues).mockReturnValue(crossPromo ? { crossPromo } : {})
}

function createBridge() {
    return {
        platformId: 'mock',
        isPlatformGamesListSupported: false,
        getGamesList: vi.fn(() => Promise.resolve([])),
        emit: vi.fn(),
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new CrossPromoModule().initialize(bridge as unknown as CrossPromoBridgeContract)
}

const CONFIG: CrossPromoConfig = {
    title: 'More games',
    games: [
        { url: 'https://example.com/pixel-run', name: 'Pixel Run' },
        { url: 'https://example.com/space-bit' },
    ],
}

describe('CrossPromoModule events', () => {
    beforeEach(() => {
        mockConfig(undefined)
        document.getElementById(CONTAINER_ID)?.remove()
    })

    test('show renders the overlay and emits the shown event with the rendered games', async () => {
        mockConfig(CONFIG)
        const bridge = createBridge()

        await createModule(bridge).show()

        expect(document.getElementById(CONTAINER_ID)).not.toBeNull()
        expect(bridge.emit).toHaveBeenCalledTimes(1)

        const [eventName, payload] = bridge.emit.mock.calls[0]
        expect(eventName).toBe(EVENT_NAME.CROSS_PROMO_SHOWN)
        expect(payload.source).toBe('config')
        expect(payload.games.map((game: { url: string }) => game.url).sort()).toEqual([
            'https://example.com/pixel-run',
            'https://example.com/space-bit',
        ])
    })

    test('show without a renderable games list renders nothing and emits nothing', async () => {
        mockConfig({ games: [] })
        const bridge = createBridge()

        await createModule(bridge).show()

        expect(document.getElementById(CONTAINER_ID)).toBeNull()
        expect(bridge.emit).not.toHaveBeenCalled()
    })

    test('a second show while the overlay is visible emits nothing new', async () => {
        mockConfig(CONFIG)
        const bridge = createBridge()
        const module = createModule(bridge)

        await module.show()
        await module.show()

        expect(bridge.emit).toHaveBeenCalledTimes(1)
    })

    test('show after hide emits again', async () => {
        mockConfig(CONFIG)
        const bridge = createBridge()
        const module = createModule(bridge)

        await module.show()
        module.hide()
        await module.show()

        expect(bridge.emit).toHaveBeenCalledTimes(2)
    })
})
