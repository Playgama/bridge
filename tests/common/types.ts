import { vi } from 'vitest'
import type { PlaygamaSdk } from './playgama/playgama.types'
import type { MessageListener } from './messageBrokerMock'

export type TestGlobalThis = Omit<typeof globalThis, 'addEventListener' | 'removeEventListener'> & {
    PLUGIN_VERSION?: string
    fetch?: ReturnType<typeof vi.fn>
    location?: Location
    PLAYGAMA_SDK?: PlaygamaSdk
    AgRuSdkMethods?: {
        ShowCampaign: string
    }
    AgRuSdk?: new () => {
        options: {
            player_id: string
            guest: string
        }
        on: (event: string, callback: () => void) => unknown
        getUsers: (playerIds: unknown, callback: (response: { data: unknown[] }) => void) => void
    }
    addEventListener: (message: string, cb: MessageListener) => void
    removeEventListener: (message: string, cb: MessageListener) => void
    parent?: {
        postMessage: (message: unknown, target: string) => void
    }
}

