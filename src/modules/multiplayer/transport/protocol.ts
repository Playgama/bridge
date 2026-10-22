import { MultiplayerError } from './types'
import type { JsonValue } from '../../../utils/json'
import type {
    MultiplayerConfig, MultiplayerPlayer, MultiplayerProperties, MultiplayerRegion,
} from './types'

export interface Session {
    sessionId: string
    sessionToken: string
    expiresAt: string
    region: MultiplayerRegion
    apiBase: string
    protocolVersion: 1
    refreshedAt?: number
}

export interface HostMetadata {
    hostPlayerId: string | null
    hostEpoch: string
    hostStatus: 'none' | 'preparing' | 'active' | 'waiting'
    syncStarted: boolean
}

export interface RoomMetadata extends HostMetadata {
    id: string
    creatorId: string
    region: MultiplayerRegion
    gameVersion: string
    maxPlayers: number
    isOpen: boolean
    isVisible: boolean
    properties: MultiplayerProperties
}

export interface Reservation {
    roomId: string
    playerId: string
    region: MultiplayerRegion
    ownerEpoch: string
    connectionGeneration: string
    expiresAt: string
    colyseus: {
        name: string
        roomId: string
        processId: string
        sessionId: string
        publicAddress: string
        [field: string]: unknown
    }
}

export type Admission = {
    status: 'grant'
    operationId: string
    created: boolean
    reservation: Reservation
} | {
    status: 'admitted'
    operationId: string
    roomId: string
    playerId: string
} | {
    status: 'pending'
    operationId: string
    retryAfterMs: number
}

export interface Welcome {
    roomId: string
    ownerEpoch: string
    revision: string
    selfPlayerId: string
    connectionGeneration: string
    room: RoomMetadata
    players: MultiplayerPlayer[]
    inviteCode: string
}

export const uuid = (): string => crypto.randomUUID()
export const decimal = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)

export function invitation(input: string): { code: string; region: MultiplayerRegion } {
    if (typeof input !== 'string' || input.length > 64 || [...input].some((char) => char.charCodeAt(0) > 127)) {
        throw new MultiplayerError('INVALID_REQUEST', 'Invalid invitation code')
    }
    const code = input.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').toUpperCase()
    const region = ({ K: 'eu', R: 'us', X: 'ap' } as const)[code[0] as 'K' | 'R' | 'X']
    if (!region || !/^[KRX][0123456789ABCDEFGHJKMNPQRSTVWXYZ]{7}$/.test(code)) {
        throw new MultiplayerError('INVALID_REQUEST', 'Invalid invitation code')
    }
    return { code, region }
}

export function validateConfig(config: MultiplayerConfig): void {
    const url = new URL(config.apiBase)
    if (!config.appToken || url.username || url.password || url.search || url.hash
        || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
        throw new MultiplayerError('INVALID_CONFIG', 'Multiplayer requires an explicit HTTPS facade and public app token')
    }
}

function validateJson(value: unknown, objectOnly = false): asserts value is JsonValue {
    const seen = new Set<object>()
    const visit = (item: unknown, depth: number): void => {
        if (depth > 64) throw new MultiplayerError('SYNC_STATE_INVALID', 'JSON nesting exceeds 64')
        if (item === null || typeof item === 'string' || typeof item === 'boolean') return
        if (typeof item === 'number' && Number.isFinite(item)) return
        if (typeof item !== 'object' || !item || seen.has(item)
            || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype
                && Object.getPrototypeOf(item) !== null)) {
            throw new MultiplayerError('SYNC_STATE_INVALID', 'State must contain only plain JSON values')
        }
        seen.add(item)
        if (Reflect.ownKeys(item).some((key) => typeof key === 'symbol')) {
            throw new MultiplayerError('SYNC_STATE_INVALID', 'Symbol keys are not JSON')
        }
        if (Array.isArray(item)) {
            for (let i = 0; i < item.length; i++) visit(item[i], depth + 1)
        } else {
            Object.values(item).forEach((child) => visit(child, depth + 1))
        }
        seen.delete(item)
    }
    if (objectOnly && (!value || typeof value !== 'object' || Array.isArray(value))) {
        throw new MultiplayerError('SYNC_STATE_INVALID', 'getState must return a JSON object')
    }
    visit(value, 0)
}

export function encodeJson(value: unknown, objectOnly = false): Uint8Array {
    validateJson(value, objectOnly)
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    if (bytes.length > 65536) throw new MultiplayerError('SYNC_STATE_TOO_LARGE', 'JSON payload exceeds 65536 bytes')
    return bytes
}

export function decodeJson(bytes: Uint8Array, objectOnly = false): JsonValue {
    if (bytes.length > 65536) throw new MultiplayerError('SYNC_STATE_TOO_LARGE', 'JSON payload exceeds 65536 bytes')
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    validateJson(value, objectOnly)
    return value
}

export function frame(header: object, payload: Uint8Array): Uint8Array {
    const json = new TextEncoder().encode(JSON.stringify(header))
    if (json.length > 2048 || payload.length > 65536) throw new MultiplayerError('INVALID_REQUEST', 'Packet exceeds limits')
    const result = new Uint8Array(4 + json.length + payload.length)
    new DataView(result.buffer).setUint32(0, json.length, false)
    result.set(json, 4)
    result.set(payload, 4 + json.length)
    return result
}

export function unframe(bytes: Uint8Array): { header: Record<string, unknown>; payload: Uint8Array } {
    if (bytes.length < 4) throw new MultiplayerError('PROTOCOL_VIOLATION', 'Truncated frame')
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false)
    if (length > 2048 || bytes.length < 4 + length || bytes.length - 4 - length > 65536) {
        throw new MultiplayerError('PROTOCOL_VIOLATION', 'Invalid frame length')
    }
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(4, 4 + length)))
    if (!header || typeof header !== 'object' || Array.isArray(header)) throw new MultiplayerError('PROTOCOL_VIOLATION')
    return { header, payload: bytes.subarray(4 + length) }
}

/**
 * Socket buffer that still accepts frames. The browser empties it only after the current task,
 * so frames sent together must fit; SendBudget limits the rate.
 */
export const MAX_BUFFERED_BYTES = 64 * 1024

/**
 * Packet pace kept under the server quota of 60 packets/s: packets bunch up on the way, and the
 * server silently drops a packet over its quota, so the client keeps headroom.
 */
export const SEND_PACKETS_PER_SECOND = 50

export const SEND_PACKET_BURST = 30

/** One budget shared by relay and snapshots, including framing. */
export class SendBudget {
    private bytes = 70 * 1024

    private packets = SEND_PACKET_BURST

    private at = performance.now()

    take(size: number): boolean {
        const now = performance.now()
        const seconds = Math.max(0, now - this.at) / 1000
        this.at = now
        this.bytes = Math.min(70 * 1024, this.bytes + seconds * 65536)
        this.packets = Math.min(SEND_PACKET_BURST, this.packets + seconds * SEND_PACKETS_PER_SECOND)
        if (this.bytes < size || this.packets < 1) return false
        this.bytes -= size
        this.packets -= 1
        return true
    }
}
