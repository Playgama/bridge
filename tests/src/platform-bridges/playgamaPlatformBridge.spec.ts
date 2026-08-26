import {
    describe, expect, test, vi,
} from 'vitest'
import PlaygamaPlatformBridge from '../../../src/platform-bridges/PlaygamaPlatformBridge'
import { PLATFORM_ID } from '../../../src/modules/platform/constants'

class TestPlaygamaPlatformBridge extends PlaygamaPlatformBridge {
    #product: Record<string, unknown> | null = null

    setPlatformSdk(sdk: unknown): void {
        this._platformSdk = sdk
    }

    setProduct(product: Record<string, unknown>): void {
        this.#product = product
    }

    setPurchases(purchases: Array<Record<string, unknown> & { id: string }>): void {
        this._paymentsPurchases = purchases
    }

    protected _paymentsGetProductPlatformData(): Record<string, unknown> | null {
        return this.#product
    }

    protected _paymentsGenerateTransactionId(): string {
        return 'generated-external-id'
    }
}

describe('PlaygamaPlatformBridge payments', () => {
    test('preserves the generated external id on a paid purchase', async () => {
        const purchase = vi.fn().mockResolvedValue({
            status: 'PAID',
            orderId: 'order-1',
            amount: 100,
        })
        const confirmDelivery = vi.fn().mockResolvedValue(undefined)
        const bridge = new TestPlaygamaPlatformBridge()
        bridge.setProduct({ id: 'coins', amount: 100 })
        bridge.setPlatformSdk({ inGamePaymentsApi: { purchase, confirmDelivery } })

        await expect(bridge.paymentsPurchase('coins')).resolves.toEqual({
            id: 'coins',
            status: 'PAID',
            orderId: 'order-1',
            amount: 100,
            externalId: 'generated-external-id',
        })
        expect(purchase).toHaveBeenCalledWith({
            id: 'coins',
            amount: 100,
            bridgeId: 'coins',
            externalId: 'generated-external-id',
        })
        expect(confirmDelivery).toHaveBeenCalledWith({
            orderId: 'order-1',
            externalId: 'generated-external-id',
        })
    })

    test('uses the order id when a restored purchase has no bridge id', async () => {
        const getPurchases = vi.fn().mockResolvedValue([
            {
                orderId: 'order-1',
                externalId: 'external-1',
                bridgeId: 'coins',
            },
            {
                orderId: 'order-2',
                externalId: 'external-2',
            },
            {
                id: 'legacy-order',
            },
        ])
        const bridge = new TestPlaygamaPlatformBridge()
        bridge.setPlatformSdk({ inGamePaymentsApi: { getPurchases } })

        await expect(bridge.paymentsGetPurchases()).resolves.toEqual([
            {
                id: 'coins',
                orderId: 'order-1',
                externalId: 'external-1',
            },
            {
                id: 'order-2',
                orderId: 'order-2',
                externalId: 'external-2',
            },
            {
                id: 'legacy-order',
                orderId: 'legacy-order',
            },
        ])
    })

    test('does not consume a receipt without its platform identifiers', async () => {
        const consumePurchase = vi.fn().mockResolvedValue(undefined)
        const bridge = new TestPlaygamaPlatformBridge()
        bridge.setPurchases([{ id: 'coins', orderId: 'order-1' }])
        bridge.setPlatformSdk({ inGamePaymentsApi: { consumePurchase } })

        await expect(bridge.paymentsConsumePurchase('coins')).rejects.toThrow(
            'Purchase receipt is missing required platform identifiers',
        )
        expect(consumePurchase).not.toHaveBeenCalled()
    })

    test('passes complete platform identifiers when consuming a purchase', async () => {
        const consumePurchase = vi.fn().mockResolvedValue(undefined)
        const bridge = new TestPlaygamaPlatformBridge()
        bridge.setPurchases([
            {
                id: 'coins',
                orderId: 'order-1',
                externalId: 'external-1',
            },
        ])
        bridge.setPlatformSdk({ inGamePaymentsApi: { consumePurchase } })

        await expect(bridge.paymentsConsumePurchase('coins')).resolves.toEqual({ id: 'coins' })
        expect(consumePurchase).toHaveBeenCalledWith('order-1', 'external-1')
    })

    test('keeps legacy Wrap receipts consumable without an external id', async () => {
        const consumePurchase = vi.fn().mockResolvedValue(undefined)
        const bridge = new TestPlaygamaPlatformBridge()
        Object.defineProperty(bridge, 'platformId', { value: PLATFORM_ID.STANDALONE })
        bridge.setPurchases([{ id: 'order-1' }])
        bridge.setPlatformSdk({ inGamePaymentsApi: { consumePurchase } })

        await expect(bridge.paymentsConsumePurchase('order-1')).resolves.toEqual({ id: 'order-1' })
        expect(consumePurchase).toHaveBeenCalledWith('order-1', undefined)
    })
})
