/* eslint-disable no-await-in-loop -- One admission keeps its operation key until the server reports admitted. */
import HttpClient, { delay, remaining } from './HttpClient'
import { MultiplayerError } from './types'
import { uuid } from './protocol'
import type { Admission, Reservation, Session } from './protocol'

export const terminalAdmissionError = (error: unknown): boolean => error instanceof MultiplayerError
    && ['CANCELLED', 'REPLACED', 'ROOM_ENDED', 'UNAUTHORIZED', 'PROTOCOL_VIOLATION'].includes(error.code)

/** Shared create/join/rejoin response handling; the caller owns its handle and cancellation. */
export async function admit<T>(options: {
    http: HttpClient
    session: Session
    path: string
    body: object
    deadline: number
    signal?: AbortSignal
    existing?: (roomId: string) => T | undefined
    connect: (reservation: Reservation, timeoutMs: number) => Promise<T>
}): Promise<T> {
    const {
        http, session, deadline, signal, existing, connect,
    } = options
    let { path, body } = options
    let key = uuid()
    while (true) {
        remaining(deadline, signal)
        const response = await http.request<Admission>(path, body, session, key, signal, deadline)
        remaining(deadline, signal)
        if (response.status === 'admitted') {
            const local = existing?.(response.roomId)
            if (local !== undefined) return local
            path = '/rooms/rejoin'
            body = { roomId: response.roomId }
            key = uuid()
        } else if (response.status === 'grant') {
            const local = existing?.(response.reservation.roomId)
            if (local !== undefined) return local
            try {
                const result = await connect(response.reservation, Math.min(10000, remaining(deadline, signal)))
                remaining(deadline, signal)
                return result
            } catch (error) {
                if (terminalAdmissionError(error)) throw error
            }
        } else throw new MultiplayerError('PROTOCOL_VIOLATION', 'Unexpected admission response')
        await delay(1000 + Math.random() * 250, signal, deadline)
    }
}
