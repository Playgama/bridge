import {
    describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest'
import YoutubePlatformBridge from '../../../src/platform-bridges/YoutubePlatformBridge'
import { EVENT_NAME } from '../../../src/constants'

vi.stubGlobal('PLUGIN_VERSION', 'test-version')

const PAGE_VISIBILITY_EVENTS = ['visibilitychange', 'pageshow', 'pagehide']

function createYtgameMock() {
    const callbacks: {
        onPause?: () => void
        onResume?: () => void
    } = {}
    let audioEnabled = true

    const sdk = {
        system: {
            getLanguage: vi.fn(() => Promise.resolve('en-US')),
            isAudioEnabled: vi.fn(() => audioEnabled),
            onAudioEnabledChange: vi.fn(),
            onPause: vi.fn((callback: () => void) => { callbacks.onPause = callback }),
            onResume: vi.fn((callback: () => void) => { callbacks.onResume = callback }),
        },
        game: {
            firstFrameReady: vi.fn(),
            gameReady: vi.fn(),
            loadData: vi.fn(() => Promise.resolve('')),
            saveData: vi.fn(() => Promise.resolve()),
        },
        ads: {},
        engagement: {},
    }

    return {
        sdk,
        callbacks,
        setAudioEnabled(value: boolean) { audioEnabled = value },
    }
}

// YouTube Playables must not use the Page Visibility API: pause, resume and
// audio come only from ytgame.system. Adding a visibility listener back must
// break this test.
describe('YoutubePlatformBridge lifecycle', () => {
    let ytgame: ReturnType<typeof createYtgameMock>

    beforeEach(() => {
        ytgame = createYtgameMock()
        window.ytgame = ytgame.sdk as unknown as Window['ytgame']
    })

    afterEach(() => {
        delete window.ytgame
        vi.restoreAllMocks()
    })

    async function createInitializedBridge() {
        const bridge = new YoutubePlatformBridge()
        await bridge.initialize()
        return bridge
    }

    test('does not use the Page Visibility API', async () => {
        const documentListener = vi.spyOn(document, 'addEventListener')
        const windowListener = vi.spyOn(window, 'addEventListener')

        const bridge = await createInitializedBridge()

        const types = [...documentListener.mock.calls, ...windowListener.mock.calls]
            .map(([type]) => type)
        expect(types.filter((type) => PAGE_VISIBILITY_EVENTS.includes(type))).toEqual([])
        expect(bridge.isPlatformPageVisibilityApiAllowed).toBe(false)
    })

    test('pause state follows ytgame onPause and onResume', async () => {
        const bridge = await createInitializedBridge()
        const pauseStates: unknown[] = []
        bridge.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: unknown) => pauseStates.push(isPaused))

        ytgame.callbacks.onPause?.()
        ytgame.callbacks.onResume?.()

        expect(pauseStates).toEqual([true, false])
    })

    test('resume re-reads the audio state missed while paused', async () => {
        const bridge = await createInitializedBridge()
        const audioStates: unknown[] = []
        bridge.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: unknown) => audioStates.push(isEnabled))

        ytgame.setAudioEnabled(false)
        ytgame.callbacks.onResume?.()

        expect(audioStates).toEqual([false])
    })
})
