import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import PlaygamaPlatformBridge from '../../../src/platform-bridges/PlaygamaPlatformBridge'
import bridgeConfig from '../../../src/lib/bridge-config'

// initialize() injects the platform SDK script and polls for the global;
// neither can happen in jsdom, so both resolve at once and the fake SDK is
// already on window when the bridge looks for it.
vi.mock('../../../src/utils', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../src/utils')>(),
    addJavaScript: () => Promise.resolve(),
    waitFor: () => Promise.resolve(),
}))

type PlaygamaSdk = NonNullable<Window['PLAYGAMA_SDK']>
type GetCatalog = NonNullable<PlaygamaSdk['inGamePaymentsApi']['getCatalog']>

const gamFallback = (id: string, amount: number) => ({
    id,
    price: `${amount} Gam`,
    priceCurrencyCode: 'Gam',
    priceCurrencyImage: 'https://games.playgama.com/assets/gold-fennec-coin-large.webp',
    priceValue: amount,
})

async function createInitializedBridge(getCatalog?: GetCatalog) {
    const sdk = {
        platformService: { getLanguage: () => 'en' },
        advService: { subscribeToAdStateChanges: vi.fn() },
        cloudSaveApi: {},
        gameService: { gameReady: vi.fn() },
        inGamePaymentsApi: { purchase: vi.fn(), getCatalog },
    }
    window.PLAYGAMA_SDK = sdk as unknown as PlaygamaSdk

    const bridge = new PlaygamaPlatformBridge()
    await bridge.initialize()
    return bridge
}

describe('Playgama payments catalog', () => {
    beforeEach(() => {
        vi.spyOn(bridgeConfig, 'getValues').mockReturnValue({
            payments: [
                { id: 'coins_100', playgama: { amount: 100 } },
                { id: 'coins_500', playgama: { amount: 500 } },
            ],
        })
    })

    test('platform prices win, products the platform omitted fall back to Gam', async () => {
        const getCatalog = vi.fn().mockResolvedValue([
            {
                id: 'coins_100', price: '$10.00', priceValue: 10, priceCurrencyCode: 'USD',
            },
        ])
        const bridge = await createInitializedBridge(getCatalog)

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            {
                id: 'coins_100', price: '$10.00', priceValue: 10, priceCurrencyCode: 'USD',
            },
            gamFallback('coins_500', 500),
        ])
        expect(getCatalog).toHaveBeenCalledWith([
            { id: 'coins_100', platformProductId: 'coins_100', amount: 100 },
            { id: 'coins_500', platformProductId: 'coins_500', amount: 500 },
        ])
    })

    test('platform without getCatalog gets the Gam fallback for every product', async () => {
        const bridge = await createInitializedBridge()

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })

    test('rejected platform getCatalog gets the Gam fallback for every product', async () => {
        const bridge = await createInitializedBridge(vi.fn().mockRejectedValue(new Error('offline')))

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })

    test('non-array platform catalog gets the Gam fallback for every product', async () => {
        const bridge = await createInitializedBridge(vi.fn().mockResolvedValue({ products: [] }))

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })
})
