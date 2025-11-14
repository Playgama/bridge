import { vi } from 'vitest'
import type { TestGlobalThis } from '../../common/types'

export class PlaygamaSdkEmulator {
    static async create(testGlobalThis: TestGlobalThis): Promise<PlaygamaSdkEmulator> {
        const instance = new PlaygamaSdkEmulator(testGlobalThis)
        await instance.initialize()
        return instance
    }

    constructor(
        private readonly testGlobalThis: TestGlobalThis
    ) {}

    async initialize(): Promise<void> {
        this.testGlobalThis.PLAYGAMA_SDK = new PlaygamaSdk()
    }
}
class PlaygamaSdk {
    userService: {
        getUser: () => Promise<unknown>
    }
    advService: {
        subscribeToAdStateChanges: ReturnType<typeof vi.fn>
    }

    constructor() {
        this.userService = {
            getUser(): Promise<unknown> {
                return Promise.reject()
            }
        }
        this.advService = {
            subscribeToAdStateChanges: vi.fn().mockResolvedValue(Promise.resolve()),
        }
    }
}
