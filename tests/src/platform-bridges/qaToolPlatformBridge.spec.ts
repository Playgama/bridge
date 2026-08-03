import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import QaToolPlatformBridge from '../../../src/platform-bridges/QaToolPlatformBridge'
import { EVENT_NAME } from '../../../src/constants'

const { sendSpy } = vi.hoisted(() => ({ sendSpy: vi.fn() }))

vi.mock('../../../src/lib/MessageBroker', () => ({
    default: class MessageBrokerMock {
        send = sendSpy

        addListener = vi.fn()

        removeListener = vi.fn()

        generateMessageId = () => 'message-id'
    },
}))

vi.stubGlobal('PLUGIN_VERSION', 'test-version')

// Pins the outbound wire format consumed by the external QA tool. The literals
// are intentional: renaming a constant must break this test, not silently
// change the protocol.
describe('QaToolPlatformBridge cross promo wire format', () => {
    beforeEach(() => {
        sendSpy.mockClear()
    })

    function createInitializedBridge() {
        const bridge = new QaToolPlatformBridge()
        // Fire-and-forget: the promise settles only when the QA tool answers,
        // which never happens in this test; the subscriptions are set synchronously.
        bridge.initialize().catch(() => {})
        return bridge
    }

    test('shown event is forwarded as a cross_promo_shown message', () => {
        const bridge = createInitializedBridge()

        bridge.emit(EVENT_NAME.CROSS_PROMO_SHOWN, {
            source: 'config',
            games: [{ url: 'https://example.com/pixel-run', name: 'Pixel Run' }],
        })

        expect(sendSpy).toHaveBeenLastCalledWith({
            source: 'bridge',
            type: 'cross_promo',
            action: 'cross_promo_shown',
            options: {
                source: 'config',
                games: [{ url: 'https://example.com/pixel-run', name: 'Pixel Run' }],
            },
        })
    })
})
