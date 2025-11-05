import { vi } from 'vitest'

export class PlaygamaSdkEmulator {
    static async create(globalThis) {
        const instance = new PlaygamaSdkEmulator(globalThis)
        await instance.initialize()
        return instance
    }

    constructor(globalThis) {
        this.globalThis = globalThis
    }

    async initialize() {
        this.globalThis.PLAYGAMA_SDK = {
            userService: {
                getUser () {
                    return Promise.reject()
                }
            },
            advService: {
                subscribeToAdStateChanges: vi.fn().mockResolvedValue(Promise.resolve()),
            },
        }
    }
}