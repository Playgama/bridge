import {
    describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest'
import PlaygamaPlatformBridge from '../../../src/platform-bridges/PlaygamaPlatformBridge'
import StandalonePlatformBridge from '../../../src/platform-bridges/StandalonePlatformBridge'
import PlaygamaSandboxPlatformBridge from '../../../src/platform-bridges/PlaygamaSandboxPlatformBridge'
import InterstitialController from '../../../src/modules/advertisement/InterstitialController'
import AdvertisementModule from '../../../src/modules/advertisement/AdvertisementModule'
import type { AdvertisementBridgeContract } from '../../../src/modules/advertisement/types'
import eventBus from '../../../src/lib/EventBus'
import { PLATFORM_MESSAGE } from '../../../src/modules/platform/constants'
import bridgeConfig from '../../../src/lib/bridge-config'
import { EVENT_NAME } from '../../../src/constants'
import { INTERSTITIAL_STATE, REWARDED_STATE } from '../../../src/modules/advertisement/constants'

vi.mock('../../../src/utils', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../src/utils')>(),
    addJavaScript: () => Promise.resolve(),
    waitFor: () => Promise.resolve(),
}))

type AdStateHandler = Parameters<NonNullable<Window['PLAYGAMA_SDK']>['advService']['subscribeToAdStateChanges']>[0]

async function createInitializedBridge(bridge = new PlaygamaPlatformBridge()) {
    const sdk = {
        platformService: { getLanguage: () => 'en' },
        advService: {
            subscribeToAdStateChanges: vi.fn((callback: AdStateHandler) => callback),
            showInterstitial: vi.fn(),
            showRewarded: vi.fn(),
        },
    }
    Object.assign(window, { PLAYGAMA_SDK: sdk })
    await bridge.initialize()
    return { bridge, sdk }
}

describe('Playgama ad frequency compatibility', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
    })

    afterEach(() => {
        eventBus.off(EVENT_NAME.PLATFORM_MESSAGE_SENT)
        vi.clearAllTimers()
        vi.useRealTimers()
        delete window.PLAYGAMA_SDK
    })

    test.each([undefined, { initialInterstitialDelay: 120, minimumDelayBetweenInterstitial: 180 }])(
        'portal skips local timers even with project overrides: %j', async (advertisement) => {
            vi.spyOn(bridgeConfig, 'getValues').mockReturnValue({ advertisement })
            const { bridge, sdk } = await createInitializedBridge()
            const timerCount = vi.getTimerCount()
            const controller = new InterstitialController(
                bridge as unknown as AdvertisementBridgeContract,
                { send: vi.fn() },
                vi.fn(),
            )
            controller.setMinimumDelay(240)
            controller.show()
            expect(sdk.advService.showInterstitial).not.toHaveBeenCalled()
            expect(controller.state).toBe(INTERSTITIAL_STATE.FAILED)

            eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, PLATFORM_MESSAGE.GAME_READY)
            controller.show()
            expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(1)

            sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]('interstitial', 'close')
            controller.setMinimumDelay(300)
            vi.setSystemTime(new Date('2026-10-21T09:00:00Z'))
            controller.show()
            expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(2)
            expect(vi.getTimerCount()).toBe(timerCount)
        },
    )

    test.each([StandalonePlatformBridge, PlaygamaSandboxPlatformBridge])(
        '%s retains initial delay, cooldown and project overrides', (Bridge) => {
            const config = { advertisement: { initialInterstitialDelay: 120, minimumDelayBetweenInterstitial: 180 } }
            vi.spyOn(bridgeConfig, 'getValues').mockReturnValue(config)
            const bridge = new Bridge()
            const show = vi.spyOn(bridge, 'showInterstitial').mockImplementation(() => {})
            const controller = new InterstitialController(
                bridge as unknown as AdvertisementBridgeContract,
                { send: vi.fn() },
                vi.fn(),
            )
            expect(bridge.initialInterstitialDelay).toBe(30)
            expect(bridge.isMinimumDelayBetweenInterstitialEnabled).toBe(true)
            eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, PLATFORM_MESSAGE.GAME_READY)
            vi.advanceTimersByTime(30000)
            controller.show()
            expect(show).not.toHaveBeenCalled()
            vi.advanceTimersByTime(90000)
            controller.show()
            expect(show).toHaveBeenCalledTimes(1)

            bridge.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.CLOSED)
            controller.setMinimumDelay(0)
            vi.advanceTimersByTime(60000)
            controller.show()
            expect(show).toHaveBeenCalledTimes(1)
            vi.advanceTimersByTime(120000)
            controller.show()
            expect(show).toHaveBeenCalledTimes(2)
        },
    )

    test('portal still prevents concurrent ads', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const advertisement = new AdvertisementModule().initialize(bridge as unknown as AdvertisementBridgeContract)
        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, PLATFORM_MESSAGE.GAME_READY)
        advertisement.showInterstitial()
        advertisement.showInterstitial()
        advertisement.showRewarded()
        expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(1)
        expect(sdk.advService.showRewarded).not.toHaveBeenCalled()
    })

    test.each(['initial_delay', 'cooldown', 'portal_rule'].flatMap((reason) => (
        [true, false].map((useAdvertisementErrorPopup) => ({ reason, useAdvertisementErrorPopup }))
    )))('fails $reason without a popup (popup=$useAdvertisementErrorPopup)', async ({ reason, useAdvertisementErrorPopup }) => {
        vi.spyOn(bridgeConfig, 'getValues').mockReturnValue({ advertisement: { useAdvertisementErrorPopup } })
        const bridge = new PlaygamaPlatformBridge()
        const popup = vi.spyOn(bridge as unknown as {
            _showAdFailurePopup(isRewarded: boolean): Promise<void>
        }, '_showAdFailurePopup').mockResolvedValue()
        const { sdk } = await createInitializedBridge(bridge)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        const interstitial = vi.fn()
        const rewarded = vi.fn()
        bridge.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, interstitial)
        bridge.on(EVENT_NAME.REWARDED_STATE_CHANGED, rewarded)

        listener('interstitial', 'error', { reason, retryAfterMs: 40000 })
        listener('rewarded', 'error', { reason, retryAfterMs: 40000 })

        expect(interstitial).toHaveBeenCalledWith(INTERSTITIAL_STATE.FAILED)
        expect(rewarded).toHaveBeenCalledWith(REWARDED_STATE.FAILED)
        expect(popup).not.toHaveBeenCalled()
    })

    test.each(['interstitial', 'rewarded'] as const)(
        'forwards every %s request after a frequency rejection', async (adType) => {
            const { bridge, sdk } = await createInitializedBridge()
            const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
            const show = adType === 'interstitial' ? () => bridge.showInterstitial() : () => bridge.showRewarded()
            const sdkShow = adType === 'interstitial' ? sdk.advService.showInterstitial : sdk.advService.showRewarded
            const failed = vi.fn()
            bridge.on(
                adType === 'interstitial' ? EVENT_NAME.INTERSTITIAL_STATE_CHANGED : EVENT_NAME.REWARDED_STATE_CHANGED,
                failed,
            )
            listener(adType, 'error', { reason: 'cooldown', retryAfterMs: 40000 })

            show()
            vi.advanceTimersByTime(1000)
            show()
            // A wall-clock adjustment must not create or extend a local retry block.
            vi.setSystemTime(new Date('2026-10-21T09:00:00Z'))
            show()
            expect(sdkShow).toHaveBeenCalledTimes(3)
            expect(failed).toHaveBeenCalledTimes(1)
        },
    )

    test('portal can allow the next request before its previous retry interval expires', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const advertisement = new AdvertisementModule().initialize(bridge as unknown as AdvertisementBridgeContract)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        eventBus.emit(EVENT_NAME.PLATFORM_MESSAGE_SENT, PLATFORM_MESSAGE.GAME_READY)
        advertisement.showInterstitial()
        listener('interstitial', 'error', { reason: 'cooldown', retryAfterMs: 40000 })

        advertisement.showInterstitial()
        listener('interstitial', 'open')
        expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(2)
        expect(advertisement.interstitialState).toBe(INTERSTITIAL_STATE.OPENED)
    })

    test.each([undefined, -1, NaN, Infinity, 0])('invalid or zero retry %s does not block another request', async (retryAfterMs) => {
        const bridge = new PlaygamaPlatformBridge()
        const popup = vi.spyOn(bridge as unknown as {
            _showAdFailurePopup(isRewarded: boolean): Promise<void>
        }, '_showAdFailurePopup').mockResolvedValue()
        const { sdk } = await createInitializedBridge(bridge)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        listener('interstitial', 'error', { reason: 'portal_rule', retryAfterMs })
        bridge.showInterstitial()
        expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(1)
        expect(popup).not.toHaveBeenCalled()
    })

    test('preserves legacy errors and no-fill popup handling', async () => {
        const bridge = new PlaygamaPlatformBridge()
        const popup = vi.spyOn(bridge as unknown as {
            _showAdFailurePopup(isRewarded: boolean): Promise<void>
        }, '_showAdFailurePopup').mockResolvedValue()
        const { sdk } = await createInitializedBridge(bridge)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        listener('interstitial', 'error')
        listener('rewarded', 'empty')
        listener('rewarded', 'error', { reason: 'no_fill' })
        listener('interstitial', 'error', { reason: 'unknown', retryAfterMs: 40000 })
        expect(popup.mock.calls).toEqual([[false], [true], [true], [false]])
        bridge.showInterstitial()
        expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(1)
    })

    test('preserves legacy show, reward and close events without metadata', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        const interstitial = vi.fn()
        const rewarded = vi.fn()
        bridge.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, interstitial)
        bridge.on(EVENT_NAME.REWARDED_STATE_CHANGED, rewarded)
        listener('interstitial', 'open')
        listener('interstitial', 'close')
        listener('rewarded', 'open')
        listener('rewarded', 'rewarded')
        listener('rewarded', 'close')
        expect(interstitial.mock.calls).toEqual([[INTERSTITIAL_STATE.OPENED], [INTERSTITIAL_STATE.CLOSED]])
        expect(rewarded.mock.calls).toEqual([
            [REWARDED_STATE.OPENED], [REWARDED_STATE.REWARDED], [REWARDED_STATE.CLOSED],
        ])
    })
})
