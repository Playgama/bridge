import { vi } from 'vitest'

export interface PlaygamaSdk {
    userService: {
        getUser: () => Promise<unknown>
    }
    advService: {
        subscribeToAdStateChanges: ReturnType<typeof vi.fn>
    }
}
