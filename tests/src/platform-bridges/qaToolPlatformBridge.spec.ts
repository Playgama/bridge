import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import QaToolPlatformBridge from '../../../src/platform-bridges/QaToolPlatformBridge'
import eventBus from '../../../src/lib/EventBus'
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
describe('QaToolPlatformBridge modules wire format', () => {
    beforeEach(() => {
        sendSpy.mockClear()
        // The bus is a singleton; drop subscriptions left by bridges from
        // previous tests so each test observes exactly one forwarder.
        eventBus.off(EVENT_NAME.CROSS_PROMO_SHOWN)
    })

    function createInitializedBridge() {
        const bridge = new QaToolPlatformBridge()
        // Fire-and-forget: the promise settles only when the QA tool answers,
        // which never happens in this test; the subscriptions are set synchronously.
        bridge.initialize().catch(() => {})
        return bridge
    }

    test('shown event is forwarded as a cross_promo_shown message', () => {
        createInitializedBridge()

        eventBus.emit(EVENT_NAME.CROSS_PROMO_SHOWN, {
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

    test('claimed event is forwarded as a daily_rewards_claimed message', () => {
        const bridge = createInitializedBridge()

        bridge.emit(EVENT_NAME.DAILY_REWARDS_CLAIMED, { day: 2, reward: 'gem' })

        expect(sendSpy).toHaveBeenLastCalledWith({
            source: 'bridge',
            type: 'daily_rewards',
            action: 'daily_rewards_claimed',
            options: { day: 2, reward: 'gem' },
        })
    })

    test('streak reset event is forwarded as a daily_rewards_streak_reset message', () => {
        const bridge = createInitializedBridge()

        bridge.emit(EVENT_NAME.DAILY_REWARDS_STREAK_RESET, { day: 4 })

        expect(sendSpy).toHaveBeenLastCalledWith({
            source: 'bridge',
            type: 'daily_rewards',
            action: 'daily_rewards_streak_reset',
            options: { day: 4 },
        })
    })

    test('initialize payload carries platform-resolved config options', () => {
        createInitializedBridge()

        const initializeMessage = sendSpy.mock.calls
            .map(([message]) => message as { action?: string, payload?: Record<string, unknown> })
            .find((message) => message.action === 'initialize')

        expect(initializeMessage).toBeDefined()
        const configFile = initializeMessage?.payload?.configFile as Record<string, unknown>
        expect(configFile.resolvedOptions).toBeDefined()
    })
})
