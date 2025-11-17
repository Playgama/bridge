import type { TestGlobalThis } from '../../common/types'
import { AgRuSdkOptions, AgRuSdkUsersResponse } from './absoluteGames.types'

export class AbsoluteGamesSdkEmulator {
    static async create(testGlobalThis: TestGlobalThis): Promise<AbsoluteGamesSdkEmulator> {
        const instance = new AbsoluteGamesSdkEmulator(testGlobalThis)
        await instance.initialize()
        return instance
    }

    constructor(
        private readonly testGlobalThis: TestGlobalThis
    ) {}

    async initialize(): Promise<void> {
        this.testGlobalThis.AgRuSdkMethods = {
            ShowCampaign: 'showCampaign',
        }
        this.testGlobalThis.AgRuSdk = AgRuSdk
    }
}

class AgRuSdk {
    options: AgRuSdkOptions

    constructor() {
        this.options = {
            player_id: '',
            guest: 'true',
        }
    }

    on(event: string, callback: () => void): AgRuSdk {
        return this
    }

    getUsers(playerIds: unknown, callback: (response: AgRuSdkUsersResponse) => void): void {
        return callback({
            data: [],
        })
    }
}