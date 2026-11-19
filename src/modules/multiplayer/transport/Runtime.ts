import HttpClient from './HttpClient'
import RoomHandle from './RoomHandle'
import { invitation } from './protocol'
import type { Session } from './protocol'
import { admit } from './admission'
import type {
    MultiplayerConfig, MultiplayerCreateOptions, MultiplayerJoinOptions, MultiplayerMatchOptions,
    MultiplayerRoom, MultiplayerRoomsQuery, MultiplayerRoomSummary, MultiplayerRegion, MultiplayerRegionList,
} from './types'

export default class MultiplayerRuntime {
    private http: HttpClient

    private rooms = new Map<string, RoomHandle>()

    private joins = new Map<string, Promise<MultiplayerRoom>>()

    private admissions = new Map<Session, Promise<unknown>>()

    get region(): MultiplayerRegion | undefined {
        return this.http.region
    }

    constructor(config: MultiplayerConfig, headers: () => Record<string, string>) {
        this.http = new HttpClient(config, headers)
    }

    // Region of the next created or matched room and of the room list.
    setRegion(region: MultiplayerRegion): void {
        this.http.selectRegion(region)
    }

    getRegions(): Promise<MultiplayerRegionList> {
        return this.http.regions()
    }

    createRoom(options: MultiplayerCreateOptions): Promise<MultiplayerRoom> {
        return this.enter('/rooms/create', options)
    }

    joinOrCreateRoom(options: MultiplayerMatchOptions): Promise<MultiplayerRoom> {
        return this.enter('/rooms/join-or-create', options)
    }

    async joinRoom(options: MultiplayerJoinOptions): Promise<MultiplayerRoom> {
        const code = options.code === undefined ? undefined : invitation(options.code)
        const existing = [...this.rooms.values()].find((room) => (
            code ? room.inviteCode === code : room.id === options.roomId
        ))
        if (existing) return existing
        const key = code || options.roomId!
        let join = this.joins.get(key)
        if (!join) {
            // A code enters its room's region; a room id comes from the list of the selected region.
            join = (code ? this.http.regionOf(code) : Promise.resolve(undefined))
                .then((region) => this.enter('/rooms/join', { ...options, ...(code ? { code } : {}) }, region))
                .finally(() => this.joins.delete(key))
            this.joins.set(key, join)
        }
        return join
    }

    async getRooms(query: MultiplayerRoomsQuery = {}): Promise<{ rooms: MultiplayerRoomSummary[]; nextCursor: string | null }> {
        const session = await this.http.session()
        const search = new URLSearchParams()
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined) search.set(key, key === 'filter' ? JSON.stringify(value) : String(value))
        })
        return this.http.request(`/rooms${search.size ? `?${search}` : ''}`, undefined, session)
    }

    private async enter(path: string, input: object, region?: MultiplayerRegion): Promise<MultiplayerRoom> {
        // Snapshot logical input before any await; application mutation cannot alter a retry.
        const body = JSON.parse(JSON.stringify(input))
        const session = await this.http.session(region)
        // Different aliases/matching requests can resolve to one membership. Serialize admission
        // for this regional identity until welcome, before issuing a potentially replacing grant.
        const previous = this.admissions.get(session) || Promise.resolve()
        const pending = previous.catch(() => {}).then(() => this.admit(path, body, session))
        this.admissions.set(session, pending)
        try { return await pending } finally {
            if (this.admissions.get(session) === pending) this.admissions.delete(session)
        }
    }

    private async admit(path: string, body: any, session: Session): Promise<MultiplayerRoom> {
        if (path === '/rooms/join') {
            const existing = [...this.rooms.values()].find((room) => (
                body.code ? room.inviteCode === body.code : room.id === body.roomId
            ))
            if (existing) return existing
        }
        let handle: RoomHandle | undefined
        try {
            return await admit({
                http: this.http,
                session,
                path,
                body,
                deadline: Date.now() + 120000,
                existing: (roomId) => this.rooms.get(roomId),
                connect: async (reservation, timeoutMs) => {
                    handle ??= this.createHandle(session, reservation.roomId)
                    await handle.connect(reservation, undefined, timeoutMs)
                    this.rooms.set(reservation.roomId, handle)
                    return handle
                },
            })
        } catch (error) {
            handle?.abandon()
            throw error
        }
    }

    private createHandle(session: Session, roomId: string): RoomHandle {
        const handle = new RoomHandle(this.http, session, () => {
            if (this.rooms.get(roomId) === handle) this.rooms.delete(roomId)
        })
        return handle
    }
}
