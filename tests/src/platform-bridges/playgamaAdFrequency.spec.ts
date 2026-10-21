import {
    describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest'
import PlaygamaPlatformBridge from '../../../src/platform-bridges/PlaygamaPlatformBridge'
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

class AdTestBridge extends PlaygamaPlatformBridge {
    readonly popup = vi.fn()

    protected override _showAdFailurePopup(isRewarded: boolean): Promise<void> {
        this.popup(isRewarded)
        return Promise.resolve()
    }
}

describe('Playgama ad frequency compatibility', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
        delete window.PLAYGAMA_SDK
    })

    test.each(['initial_delay', 'cooldown', 'portal_rule'].flatMap((reason) => (
        [true, false].map((useAdvertisementErrorPopup) => ({ reason, useAdvertisementErrorPopup }))
    )))('fails $reason without a popup (popup=$useAdvertisementErrorPopup)', async ({ reason, useAdvertisementErrorPopup }) => {
        vi.spyOn(bridgeConfig, 'getValues').mockReturnValue({ advertisement: { useAdvertisementErrorPopup } })
        const bridge = new AdTestBridge()
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
        expect(bridge.popup).not.toHaveBeenCalled()
    })

    test.each(['interstitial', 'rewarded'] as const)('honours %s retry time without extending it', async (adType) => {
        const { bridge, sdk } = await createInitializedBridge()
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        const show = adType === 'interstitial' ? () => bridge.showInterstitial() : () => bridge.showRewarded()
        const sdkShow = adType === 'interstitial' ? sdk.advService.showInterstitial : sdk.advService.showRewarded
        const failed = vi.fn()
        bridge.on(adType === 'interstitial' ? EVENT_NAME.INTERSTITIAL_STATE_CHANGED : EVENT_NAME.REWARDED_STATE_CHANGED, failed)
        listener(adType, 'error', { reason: 'cooldown', retryAfterMs: 40000 })

        vi.advanceTimersByTime(20000)
        show()
        vi.advanceTimersByTime(19999)
        show()
        expect(sdkShow).not.toHaveBeenCalled()
        expect(failed).toHaveBeenCalledTimes(3)

        vi.advanceTimersByTime(1)
        show()
        expect(sdkShow).toHaveBeenCalledTimes(1)
    })

    test('keeps ad-type retry intervals independent', async () => {
        const { bridge, sdk } = await createInitializedBridge()
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        listener('interstitial', 'error', { reason: 'initial_delay', retryAfterMs: 40000 })
        bridge.showInterstitial()
        bridge.showRewarded()
        expect(sdk.advService.showInterstitial).not.toHaveBeenCalled()
        expect(sdk.advService.showRewarded).toHaveBeenCalledTimes(1)
    })

    test.each([undefined, -1, NaN, Infinity, 0])('invalid or zero retry %s does not block another request', async (retryAfterMs) => {
        const bridge = new AdTestBridge()
        const { sdk } = await createInitializedBridge(bridge)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        listener('interstitial', 'error', { reason: 'portal_rule', retryAfterMs })
        bridge.showInterstitial()
        expect(sdk.advService.showInterstitial).toHaveBeenCalledTimes(1)
        expect(bridge.popup).not.toHaveBeenCalled()
    })

    test('preserves legacy errors and no-fill popup handling', async () => {
        const bridge = new AdTestBridge()
        const { sdk } = await createInitializedBridge(bridge)
        const listener = sdk.advService.subscribeToAdStateChanges.mock.calls[0][0]
        listener('interstitial', 'error')
        listener('rewarded', 'empty')
        listener('rewarded', 'error', { reason: 'no_fill' })
        listener('interstitial', 'error', { reason: 'unknown', retryAfterMs: 40000 })
        expect(bridge.popup.mock.calls).toEqual([[false], [true], [true], [false]])
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
