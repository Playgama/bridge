import { vi } from 'vitest'
import type { TestGlobalThis } from '../../common/types'

export interface PlaygamaSdk {
    userService: {
        getUser: () => Promise<unknown>
    }
    advService: {
        subscribeToAdStateChanges: ReturnType<typeof vi.fn>
    }
}

export type GlobalWithPlaygamaSdk = TestGlobalThis & {
    PLAYGAMA_SDK?: PlaygamaSdk
}