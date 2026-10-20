/* eslint-disable no-await-in-loop -- Admission retries are ordered and reuse one operation key. */
import HttpClient, { delay } from './HttpClient'
import RoomHandle from './RoomHandle'
import { invitation, uuid } from './protocol'
import type { Admission, Session } from './protocol'
import { MultiplayerError } from './types'
import type {
    MultiplayerConfig, MultiplayerCreateOptions, MultiplayerJoinOptions, MultiplayerMatchOptions,
    MultiplayerRoom, MultiplayerRoomsQuery, MultiplayerRoomSummary, MultiplayerRegion,
} from './types'

export default class MultiplayerRuntime {
    private http: HttpClient

    private rooms = new Map<string, RoomHandle>()

    private joins = new Map<string, Promise<MultiplayerRoom>>()

    private admissions = new Map<Session, Promise<unknown>>()

    constructor(config: MultiplayerConfig, headers: () => Record<string, string>) {
        this.http = new HttpClient(config, headers)
    }

    createRoom(options: MultiplayerCreateOptions): Promise<MultiplayerRoom> {
        return this.enter('/rooms/create', options)
    }

    joinOrCreateRoom(options: MultiplayerMatchOptions): Promise<MultiplayerRoom> {
        return this.enter('/rooms/join-or-create', options)
    }

    async joinRoom(options: MultiplayerJoinOptions): Promise<MultiplayerRoom> {
        const parsed = options.code === undefined ? undefined : invitation(options.code)
        const existing = [...this.rooms.values()].find((room) => (
            parsed ? room.inviteCode === parsed.code : room.id === options.roomId
        ))
        if (existing) return existing
        const key = parsed?.code || options.roomId!
        let join = this.joins.get(key)
        if (!join) {
            join = this.enter('/rooms/join', { ...options, ...(parsed ? { code: parsed.code } : {}) }, parsed?.region)
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
        let endpoint = path
        let requestBody = body
        let key = uuid()
        let handle: RoomHandle | undefined
        const deadline = Date.now() + 120000
        try {
            while (Date.now() < deadline) {
                const response = await this.http.request<Admission>(endpoint, requestBody, session, key)
                if (response.status === 'admitted') {
                    const existing = this.rooms.get(response.roomId)
                    if (existing) return existing
                    endpoint = '/rooms/rejoin'
                    requestBody = { roomId: response.roomId }
                    key = uuid()
                } else if (response.status === 'grant') {
                    const { reservation } = response
                    const existing = this.rooms.get(reservation.roomId)
                    if (existing) return existing
                    handle ??= this.createHandle(session, reservation.roomId)
                    try {
                        await handle.connect(reservation)
                        this.rooms.set(reservation.roomId, handle)
                        return handle
                    } catch (error) {
                        if (error instanceof MultiplayerError
                            && ['CANCELLED', 'REPLACED', 'ROOM_ENDED', 'UNAUTHORIZED', 'PROTOCOL_VIOLATION'].includes(error.code)) throw error
                    }
                } else throw new MultiplayerError('PROTOCOL_VIOLATION', 'Unexpected admission response')
                await delay(1000 + Math.random() * 250)
            }
            throw new MultiplayerError('NETWORK_TIMEOUT')
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
