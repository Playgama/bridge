import { vi } from 'vitest'

export interface PlaygamaPlayer {
    authorized: boolean
    id: string
    name: string
    photos: string[]
    extra: Record<string, unknown>
}

export interface PlaygamaSdk {
    userService: {
        getUser: () => Promise<PlaygamaPlayer>
        authorizeUser: () => Promise<boolean>
    }
    advService: {
        subscribeToAdStateChanges: ReturnType<typeof vi.fn>
    }
    cloudSaveApi: {
        getState: () => Promise<Record<string, unknown>>
        setItems: (items: Record<string, unknown>) => Promise<void>
    }
}
