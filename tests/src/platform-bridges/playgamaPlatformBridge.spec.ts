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
        inGamePaymentsApi: { purchase: vi.fn(), getCatalog, getPurchases: vi.fn(), confirmDelivery: vi.fn().mockResolvedValue(undefined) },
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

    test('failed catalog refresh preserves displayed USD prices and purchase terms', async () => {
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

        await expect(bridge.paymentsGetCatalog()).resolves.toEqual([
            { id: 'coins_100', price: '$10.00', priceValue: 10, priceCurrencyCode: 'USD' },
            gamFallback('coins_500', 500),
        ])
        await bridge.paymentsPurchase('coins_100')
        expect(purchase).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'coins_100', amount: 1000, currency: 'usd' }),
        )
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
    test('new and restored fiat receipts use the same config units without a currency key', async () => {
        const { bridge, sdk } = await createInitializedBridge(vi.fn().mockResolvedValue([{
            id: 'coins_100', amount: 1000, currency: 'usd', price: '$10.00',
            priceValue: 10, priceCurrencyCode: 'USD',
        }]))
        const paid = { status: 'PAID', orderId: 'order-fiat', externalId: 'external', amount: 1000, currency: 'usd' }
        sdk.inGamePaymentsApi.purchase.mockResolvedValue(paid)
        sdk.inGamePaymentsApi.getPurchases.mockResolvedValue([{ ...paid, bridgeId: 'coins_100' }])
        await bridge.paymentsGetCatalog()
        const receipt = await bridge.paymentsPurchase('coins_100')
        const expected = { id: 'coins_100', status: 'PAID', orderId: 'order-fiat', externalId: 'external', amount: 100 }
        expect(receipt).toStrictEqual(expected)
        expect(receipt).not.toHaveProperty('currency')
        await expect(bridge.paymentsGetPurchases()).resolves.toStrictEqual([expected])
        expect(sdk.inGamePaymentsApi.confirmDelivery).toHaveBeenCalledWith({ orderId: 'order-fiat', externalId: 'external' })
        expect(paid).toHaveProperty('currency', 'usd')

    })

    test('restoration normalizes known fiat products without a catalog and preserves unknown products', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const paid = { status: 'PAID', orderId: 'restored', amount: 1000, currency: 'USD' }
        sdk.inGamePaymentsApi.getPurchases.mockResolvedValue([
            { ...paid, bridgeId: 'coins_100' },
            { ...paid, bridgeId: 'removed_product' },
        ])
        await expect(bridge.paymentsGetPurchases()).resolves.toStrictEqual([
            { id: 'coins_100', status: 'PAID', orderId: 'restored', amount: 100 },
            { id: 'removed_product', ...paid },
        ])
    })

    test('explicit GAM catalog terms leave new and restored GAM receipts unchanged', async () => {
        const { bridge, sdk } = await createInitializedBridge(vi.fn().mockResolvedValue([{
            id: 'coins_100', amount: 100, currency: 'gam', price: '100 Gam',
            priceValue: 100, priceCurrencyCode: 'Gam',
        }]))
        const paid = { status: 'PAID', orderId: 'order-gam', amount: 100, currency: 'gam' }
        sdk.inGamePaymentsApi.purchase.mockResolvedValue(paid)
        sdk.inGamePaymentsApi.getPurchases.mockResolvedValue([{ ...paid, bridgeId: 'coins_100' }])
        await bridge.paymentsGetCatalog()
        await expect(bridge.paymentsPurchase('coins_100')).resolves.toStrictEqual({ id: 'coins_100', ...paid })
        await expect(bridge.paymentsGetPurchases()).resolves.toStrictEqual([{ id: 'coins_100', ...paid }])
    })

    test.each([
        [{ status: 'PAID', amount: 1000 }, { id: 'coins_100', status: 'PAID', amount: 100 }],
        [{ status: 'PAID', amount: 90, currency: 'gam' }, { id: 'coins_100', status: 'PAID', amount: 90, currency: 'gam' }],
    ])('receipt currency takes precedence over requested USD terms: %j', async (paid, expected) => {
        const { bridge, sdk } = await createInitializedBridge(vi.fn().mockResolvedValue([{
            id: 'coins_100', amount: 1000, currency: 'usd', price: '$10.00',
            priceValue: 10, priceCurrencyCode: 'USD',
        }]))
        sdk.inGamePaymentsApi.purchase.mockResolvedValue(paid)
        await bridge.paymentsGetCatalog()
        await expect(bridge.paymentsPurchase('coins_100')).resolves.toStrictEqual(expected)
    })

    test('catalog exposes display fields only and a successful refresh replaces purchase terms', async () => {
        const usd = {
            id: 'coins_100', amount: 1000, currency: 'usd', price: '$10.00', priceValue: 10,
            priceCurrencyCode: 'USD', priceCurrencyImage: 'usd.png',
        }
        const getCatalog = vi.fn().mockResolvedValueOnce([usd]).mockResolvedValueOnce([])
        const { bridge, sdk } = await createInitializedBridge(getCatalog)
        await expect(bridge.paymentsGetCatalog()).resolves.toStrictEqual([
            { id: 'coins_100', price: '$10.00', priceValue: 10, priceCurrencyCode: 'USD', priceCurrencyImage: 'usd.png' },
            gamFallback('coins_500', 500),
        ])
        await expect(bridge.paymentsGetCatalog()).resolves.toStrictEqual([
            gamFallback('coins_100', 100), gamFallback('coins_500', 500),
        ])
        sdk.inGamePaymentsApi.purchase.mockResolvedValue({ status: 'PAID', amount: 100 })
        await bridge.paymentsPurchase('coins_100')
        expect(sdk.inGamePaymentsApi.purchase.mock.lastCall?.[0]).not.toHaveProperty('currency')
    })

})
