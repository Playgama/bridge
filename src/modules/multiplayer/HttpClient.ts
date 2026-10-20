/* eslint-disable no-await-in-loop -- Retries must preserve one sequential operation. */
import { MultiplayerError } from './types'
import type { MultiplayerConfig, MultiplayerRegion } from './types'
import { validateConfig } from './protocol'
import type { Session } from './protocol'

export const delay = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    const abort = (): void => {
        clearTimeout(timer)
        reject(new MultiplayerError('CANCELLED'))
    }
    const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort)
        resolve()
    }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
})

export default class HttpClient {
    private config: MultiplayerConfig

    private headers: () => Record<string, string>

    private sessions = new Map<MultiplayerRegion, Session>()

    private pending = new Map<string, Promise<Session>>()

    private refreshing = new Map<Session, Promise<void>>()

    private selectedRegion?: MultiplayerRegion

    private refreshTimers = new Map<Session, ReturnType<typeof setTimeout>>()

    constructor(config: MultiplayerConfig, headers: () => Record<string, string>) {
        validateConfig(config)
        this.config = { ...config, apiBase: config.apiBase.replace(/\/+$/, '') }
        this.headers = headers
        this.selectedRegion = config.region
        if (!this.selectedRegion) {
            try {
                const selected = sessionStorage.getItem(this.selectionKey())
                if (selected && ['eu', 'us', 'ap'].includes(selected)) this.selectedRegion = selected as MultiplayerRegion
            } catch { /* Storage is optional. */ }
        }
        // Refreshing never replaces a handle's session or returns its old membership under a new identity.
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.sessions.forEach((session) => { this.refresh(session).catch(() => {}) })
                }
            })
        }
    }

    async session(region = this.selectedRegion): Promise<Session> {
        if (region) {
            const existing = this.sessions.get(region) || this.restore(region)
            if (existing && Date.parse(existing.expiresAt) > Date.now()) {
                if (Date.now() - (existing.refreshedAt || 0) >= 12 * 3600 * 1000) await this.refresh(existing)
                return existing
            }
        }
        const key = region || 'default'
        let pending = this.pending.get(key)
        if (!pending) {
            pending = this.createSession(region).finally(() => this.pending.delete(key))
            this.pending.set(key, pending)
        }
        return pending
    }

    async request<T>(path: string, body?: unknown, session?: Session, key?: string, signal?: AbortSignal): Promise<T> {
        const serialized = body === undefined ? undefined : JSON.stringify(body)
        if (serialized && new TextEncoder().encode(serialized).length > 16384) {
            throw new MultiplayerError('INVALID_REQUEST', 'Request exceeds 16384 bytes')
        }
        const started = Date.now()
        let attempt = 0
        while (true) {
            if (signal?.aborted) throw new MultiplayerError('CANCELLED')
            if (session && Date.parse(session.expiresAt) <= Date.now()) throw new MultiplayerError('UNAUTHORIZED')
            const controller = new AbortController()
            const abort = (): void => controller.abort()
            signal?.addEventListener('abort', abort, { once: true })
            const timeout = setTimeout(abort, 10000)
            let retryAfter = 0
            try {
                const response = await fetch(`${session?.apiBase || this.config.apiBase}${path}`, {
                    method: serialized === undefined ? 'GET' : 'POST',
                    credentials: 'omit',
                    headers: {
                        ...this.headers(),
                        'Content-Type': 'application/json',
                        'x-public-token': this.config.appToken,
                        ...(session ? { Authorization: `Bearer ${session.sessionToken}` } : {}),
                        ...(key ? { 'Idempotency-Key': key } : {}),
                    },
                    body: serialized,
                    signal: controller.signal,
                })
                const retryHeader = response.headers.get('Retry-After')
                if (retryHeader) {
                    retryAfter = /^\d+(\.\d+)?$/.test(retryHeader)
                        ? Number(retryHeader) * 1000 : Math.max(0, Date.parse(retryHeader) - Date.now())
                }
                const result = await response.json()
                if (response.ok && result.status !== 'pending') return result as T
                if (response.status === 202 && result.status === 'pending') {
                    retryAfter = Math.max(retryAfter, Number(result.retryAfterMs) || 1000)
                } else if (response.status === 429 || response.status >= 500) {
                    retryAfter = Math.max(retryAfter, Number(result.error?.retryAfterMs) || 0)
                } else {
                    throw new MultiplayerError(result.error?.code || 'HTTP_ERROR', result.error?.message)
                }
            } catch (error) {
                if (error instanceof MultiplayerError) throw error
                if (signal?.aborted) throw new MultiplayerError('CANCELLED')
                // A lost response keeps the serialized body, regional session and UUID unchanged.
            } finally {
                clearTimeout(timeout)
                signal?.removeEventListener('abort', abort)
            }
            if (Date.now() - started >= 120000) throw new MultiplayerError('NETWORK_TIMEOUT')
            const backoff = Math.min(5000, 500 * (2 ** Math.min(attempt, 4)))
            attempt += 1
            await delay(Math.max(retryAfter, backoff + Math.random() * 250), signal)
        }
    }

    refresh(session: Session): Promise<void> {
        let pending = this.refreshing.get(session)
        if (!pending) {
            pending = this.request<{ sessionId: string; expiresAt: string }>('/sessions/refresh', {}, session)
                .then((result) => {
                    if (result.sessionId !== session.sessionId) throw new MultiplayerError('PROTOCOL_VIOLATION')
                    Object.assign(session, { expiresAt: result.expiresAt, refreshedAt: Date.now() })
                    this.persist(session)
                    this.scheduleRefresh(session)
                })
                .finally(() => this.refreshing.delete(session))
            this.refreshing.set(session, pending)
        }
        return pending
    }

    private storageKey(region: MultiplayerRegion): string {
        return `playgama.multiplayer.v1:${JSON.stringify([
            this.config.environment, this.config.apiBase, this.config.appToken, region,
        ])}`
    }

    private selectionKey(): string {
        return `${this.storageKey('eu')}:selected-region`
    }

    private scheduleRefresh(session: Session, retryAfterMs?: number): void {
        clearTimeout(this.refreshTimers.get(session))
        const timer = setTimeout(() => {
            this.refreshTimers.delete(session)
            this.refresh(session).catch((error) => {
                // A foreground WSS-only game must recover refresh after a facade outage.
                // Keep the same identity and stop retrying revoked/expired sessions.
                if (error instanceof MultiplayerError && error.code === 'NETWORK_TIMEOUT'
                    && Date.parse(session.expiresAt) > Date.now()) this.scheduleRefresh(session, 60000)
            })
        }, retryAfterMs ?? Math.max(1000, (session.refreshedAt || Date.now()) + 12 * 3600 * 1000 - Date.now()))
        timer.unref?.()
        this.refreshTimers.set(session, timer)
    }

    private restore(region: MultiplayerRegion): Session | undefined {
        try {
            const saved = sessionStorage.getItem(this.storageKey(region))
            if (!saved) return undefined
            const session = JSON.parse(saved) as Session
            this.validateSession(session, region)
            if (Date.parse(session.expiresAt) <= Date.now()) return undefined
            this.sessions.set(region, session)
            this.scheduleRefresh(session)
            return session
        } catch {
            return undefined
        }
    }

    private persist(session: Session): void {
        try { sessionStorage.setItem(this.storageKey(session.region), JSON.stringify(session)) } catch { /* Memory-only works. */ }
    }

    private validateSession(session: Session, region?: MultiplayerRegion): void {
        const endpoint = new URL(session.apiBase)
        const root = new URL(this.config.apiBase)
        if (session.protocolVersion !== 1 || !session.sessionId || !session.sessionToken
            || !['eu', 'us', 'ap'].includes(session.region) || (region && session.region !== region)
            || !Number.isFinite(Date.parse(session.expiresAt))
            || endpoint.origin !== root.origin
            || endpoint.pathname !== `${root.pathname}/regions/${session.region}`
            || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
            throw new MultiplayerError('PROTOCOL_VIOLATION', 'Invalid regional session response')
        }
    }

    private async createSession(region?: MultiplayerRegion): Promise<Session> {
        const incoming = await this.request<Session>('/sessions', region ? { region } : {})
        this.validateSession(incoming, region)
        // Default-region and invite-region creation may race. Select one identity BEFORE any room POST.
        const established = this.sessions.get(incoming.region) || this.restore(incoming.region)
        const selected = established && Date.parse(established.expiresAt) > Date.now() ? established : incoming
        selected.refreshedAt ??= Date.now()
        this.sessions.set(selected.region, selected)
        if (!region) {
            this.selectedRegion = selected.region
            try { sessionStorage.setItem(this.selectionKey(), selected.region) } catch { /* Storage is optional. */ }
        }
        this.persist(selected)
        this.scheduleRefresh(selected)
        return selected
    }
}
