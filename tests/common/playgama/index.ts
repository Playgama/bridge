import { vi } from 'vitest'
import { GlobalWithPlaygamaSdk } from './types'
import type { TestGlobalThis } from '../../common/types'

export class PlaygamaSdkEmulator {
    private globalScope: GlobalWithPlaygamaSdk

    static async create(globalScope: TestGlobalThis): Promise<PlaygamaSdkEmulator> {
        const instance = new PlaygamaSdkEmulator(globalScope as unknown as GlobalWithPlaygamaSdk)
        await instance.initialize()
        return instance
    }

    constructor(globalScope: GlobalWithPlaygamaSdk) {
        this.globalScope = globalScope
    }

    async initialize(): Promise<void> {
        this.globalScope.PLAYGAMA_SDK = new PlaygamaSdk()
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
