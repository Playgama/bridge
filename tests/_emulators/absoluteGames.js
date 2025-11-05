export class AbsoluteGamesSdkEmulator {
    static async create(globalThis) {
        const instance = new AbsoluteGamesSdkEmulator(globalThis)
        await instance.initialize()
        return instance
    }

    constructor(globalThis) {
        this.globalThis = globalThis
    }

    async initialize() {
        this.globalThis.AgRuSdkMethods = {
            ShowCampaign: 'showCampaign',
        }
        this.globalThis.AgRuSdk = class AgRuSdk {
            constructor() {
                this.options = {
                    player_id: '',
                    guest: 'true',
                }
            }
            on(event, callback) {
                return this
            }
            getUsers(playerIds, callback) {
                return callback({
                    data: [],
                })
            }
        }
    }
}