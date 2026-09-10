import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import PlaygamaPlatformBridge from '../../../src/platform-bridges/PlaygamaPlatformBridge'
import configFileModule from '../../../src/modules/ConfigFileModule'

// initialize() injects the platform SDK script and polls for the global;
// neither can happen in jsdom, so both resolve at once and the fake SDK is
// already on window when the bridge looks for it.
vi.mock('../../../src/common/utils', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../src/common/utils')>(),
    addJavaScript: () => Promise.resolve(),
    waitFor: () => Promise.resolve(),
}))

type GetCatalog = (products: unknown[]) => Promise<unknown>

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
    Object.assign(window, { PLAYGAMA_SDK: sdk })

    const bridge = new PlaygamaPlatformBridge()
    await bridge.initialize()
    return { bridge, sdk }
}

describe('Playgama payments catalog', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.spyOn(configFileModule, 'getPlatformOptions').mockReturnValue({
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
        const { bridge } = await createInitializedBridge(getCatalog)

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
        const { bridge } = await createInitializedBridge()

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })

    test('rejected platform getCatalog gets the Gam fallback for every product', async () => {
        const { bridge } = await createInitializedBridge(vi.fn().mockRejectedValue(new Error('offline')))

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })

    test('non-array platform catalog gets the Gam fallback for every product', async () => {
        const { bridge } = await createInitializedBridge(vi.fn().mockResolvedValue({ products: [] }))

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            gamFallback('coins_500', 500),
        ])
    })

    test('purchase sends the terms of the accepted platform price, or the config amount after a fallback', async () => {
        const usdPrice = {
            id: 'coins_100', amount: 1000, currency: 'usd', price: '$10.00', priceValue: 10, priceCurrencyCode: 'USD',
        }
        const getCatalog = vi.fn().mockResolvedValueOnce([usdPrice]).mockRejectedValueOnce(new Error('timeout'))
        const { bridge, sdk } = await createInitializedBridge(getCatalog)
        const purchase = sdk.inGamePaymentsApi.purchase
        purchase.mockResolvedValue({
            status: 'PAID', orderId: 'order-1', amount: 1000, currency: 'usd',
        })

        await bridge.paymentsGetCatalog()
        await expect(bridge.paymentsPurchase('coins_100')).resolves.toEqual({
            id: 'coins_100', status: 'PAID', orderId: 'order-1', amount: 100,
        })
        expect(purchase).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'coins_100', amount: 1000, currency: 'usd' }),
        )

        await bridge.paymentsGetCatalog()
        await bridge.paymentsPurchase('coins_100')
        expect(purchase).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'coins_100', amount: 100 }))
        expect(purchase.mock.lastCall?.[0]).not.toHaveProperty('currency')
    })

    test('purchase without a catalog retains GAM config terms and the original receipt', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const receipt = { status: 'PAID', orderId: 'order-legacy', amount: 100 }
        sdk.inGamePaymentsApi.purchase.mockResolvedValue(receipt)

        await expect(bridge.paymentsPurchase('coins_100', { externalId: 'game-order' })).resolves.toEqual({
            id: 'coins_100', ...receipt,
        })
        expect(sdk.inGamePaymentsApi.purchase).toHaveBeenCalledWith({
            id: 'coins_100', platformProductId: 'coins_100', bridgeId: 'coins_100',
            amount: 100, externalId: 'game-order',
        })
    })

    test('a product omitted from a localized catalog still purchases in GAM', async () => {
        const { bridge, sdk } = await createInitializedBridge(vi.fn().mockResolvedValue([{
            id: 'coins_100', amount: 1000, currency: 'usd', price: '$10.00',
            priceValue: 10, priceCurrencyCode: 'USD',
        }]))
        sdk.inGamePaymentsApi.purchase.mockResolvedValue({ status: 'PAID', amount: 500 })

        await bridge.paymentsGetCatalog()
        await bridge.paymentsPurchase('coins_500')
        expect(sdk.inGamePaymentsApi.purchase).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'coins_500', amount: 500 }),
        )
        expect(sdk.inGamePaymentsApi.purchase.mock.lastCall?.[0]).not.toHaveProperty('currency')
    })

    test('malformed entries in the platform catalog are skipped, not fatal', async () => {
        const { bridge } = await createInitializedBridge(vi.fn().mockResolvedValue([
            null,
            { price: '$1.00' },
            {
                id: 'coins_500', price: '$50.00', priceValue: 50, priceCurrencyCode: 'USD',
            },
        ]))

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            gamFallback('coins_100', 100),
            {
                id: 'coins_500', price: '$50.00', priceValue: 50, priceCurrencyCode: 'USD',
            },
        ])
    })
})
