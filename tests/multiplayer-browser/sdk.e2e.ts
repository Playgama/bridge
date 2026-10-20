import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const config = {
    apiBase: process.env.MP_API_BASE!,
    appToken: process.env.MP_PUBLIC_TOKEN!,
    environment: process.env.MP_ENVIRONMENT || 'local-integration',
    region: 'eu',
}

// Each peer has its own browser context and independent sessionStorage identity.
async function peer(browser: Browser, clonedStorage?: Record<string, string>): Promise<{ context: BrowserContext; page: Page; requests: string[] }> {
    const context = await browser.newContext()
    if (clonedStorage) {
        await context.addInitScript((entries) => {
            Object.entries(entries).forEach(([key, value]) => sessionStorage.setItem(key, value))
        }, clonedStorage)
    }
    const page = await context.newPage()
    const requests: string[] = []
    const externalRequests: string[] = []
    await context.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
            externalRequests.push(url.origin)
            await route.abort()
        } else await route.continue()
    })
    page.on('request', (request) => {
        // Paths only: never retain query strings, headers, tokens or POST bodies.
        requests.push(new URL(request.url()).pathname)
    })
    await page.goto('/examples/multiplayer/harness.html')
    await page.waitForFunction(() => Boolean((window as any).sdkTest))
    expect(requests.some((path) => path.endsWith('/multiplayer.js'))).toBe(false)
    await page.evaluate((value) => (window as any).sdkTest.initialize(value), config)
    expect(externalRequests).toEqual([])
    expect(requests.some((path) => path.endsWith('/multiplayer.js'))).toBe(false)
    return { context, page, requests }
}

const snapshot = (page: Page) => page.evaluate(() => (window as any).sdkTest.snapshot())
const enter = (page: Page, method: string, options: object) => page.evaluate(
    (value) => (window as any).sdkTest.enter(value.method, value.options), { method, options },
)
const ready = (page: Page) => expect.poll(async () => (await snapshot(page)).isReady, { timeout: 20000 }).toBe(true)

test('built lazy SDK: create, invite, late join, stable snapshots, relay, metadata and leave', async ({ browser }) => {
    const peers = await Promise.all([peer(browser), peer(browser), peer(browser)])
    try {
        const [a, b, late] = peers
        await enter(a.page, 'createRoom', { player: { name: 'A' }, maxPlayers: 4, gameVersion: 'sdk-browser-v1' })
        await ready(a.page)
        expect(a.requests.some((path) => path.endsWith('/multiplayer.js'))).toBe(true)
        expect(a.requests.filter((path) => path.endsWith('/sessions'))).toHaveLength(1)
        const code = await a.page.evaluate(() => (window as any).sdkTest.code())
        await enter(b.page, 'joinRoom', { code, player: { name: 'B' }, gameVersion: 'sdk-browser-v1' })
        await ready(b.page)
        const first = await snapshot(a.page)
        const second = await snapshot(b.page)
        expect(first.playerId).not.toBe(second.playerId)
        expect(first.roomId).toBe(second.roomId)
        expect(second.isHost).toBe(false)
        await b.page.evaluate(() => (window as any).sdkTest.send(7))
        await expect.poll(async () => (await snapshot(a.page)).world.counter).toBe(7)
        await a.page.evaluate(() => (window as any).sdkTest.freeze())
        await enter(late.page, 'joinRoom', { code, player: { name: 'Late' }, gameVersion: 'sdk-browser-v1' })
        await ready(late.page)
        await expect.poll(async () => (await snapshot(late.page)).world).toEqual((await snapshot(a.page)).world)
        await expect.poll(async () => (await snapshot(b.page)).world).toEqual((await snapshot(a.page)).world)
        await expect.poll(async () => (await snapshot(a.page)).players.length).toBe(3)
        await b.page.evaluate(() => (window as any).sdkTest.leave())
        await expect.poll(async () => (await snapshot(a.page)).players.length).toBe(2)
        expect((await snapshot(b.page)).connectionState).toBe('disconnected')
        expect((await snapshot(b.page)).isHost).toBe(false)
    } finally {
        await Promise.all(peers.map(async ({ page, context }) => {
            await page.evaluate(() => (window as any).sdkTest.leave()).catch(() => {})
            await context.close()
        }))
    }
})

test('native short return, HTTP fallback, cloned-tab terminal replacement and outage-safe leave', async ({ browser }) => {
    const peers = await Promise.all([peer(browser), peer(browser)])
    try {
        const [a, b] = peers
        await enter(a.page, 'createRoom', { player: { name: 'A' }, maxPlayers: 4 })
        await ready(a.page)
        const code = await a.page.evaluate(() => (window as any).sdkTest.code())
        await enter(b.page, 'joinRoom', { code, player: { name: 'B' } })
        await ready(b.page)
        const playerId = (await snapshot(b.page)).playerId
        await a.page.evaluate(() => (window as any).sdkTest.freeze())
        await expect.poll(async () => (await snapshot(b.page)).world.frozen).toBe(true)

        await b.page.evaluate(() => (window as any).sdkTest.drop())
        await ready(b.page)
        expect(b.requests.filter((path) => path.endsWith('/rooms/rejoin'))).toHaveLength(0)
        expect((await snapshot(b.page)).playerId).toBe(playerId)

        await b.context.setOffline(true)
        await b.page.evaluate(() => (window as any).sdkTest.drop())
        // Outlive the native window while retaining the JS heap, then use the facade rejoin path.
        await b.page.waitForTimeout(22000)
        await b.context.setOffline(false)
        await ready(b.page)
        expect(b.requests.some((path) => path.endsWith('/rooms/rejoin'))).toBe(true)
        expect((await snapshot(b.page)).playerId).toBe(playerId)

        const copiedStorage = await b.page.evaluate(() => Object.fromEntries(
            Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key)!]),
        ))
        const clone = await peer(browser, copiedStorage)
        peers.push(clone)
        await enter(clone.page, 'joinRoom', { code, player: { name: 'Clone' } })
        await ready(clone.page)
        await expect.poll(async () => (await snapshot(b.page)).errors).toContain('REPLACED')
        expect((await snapshot(b.page)).connectionState).toBe('disconnected')
        expect((await snapshot(clone.page)).playerId).toBe(playerId)

        let blockLeave = true
        await a.context.route('**/rooms/leave', async (route) => {
            if (blockLeave) await route.abort()
            else await route.continue()
        })
        // Start leave without awaiting confirmation; keep WSS healthy except the SDK's deliberate close.
        await a.page.evaluate(() => {
            const target = window as any
            target.leaveComplete = false
            target.sdkTest.leave().then(() => { target.leaveComplete = true })
        })
        await expect.poll(async () => (await snapshot(clone.page)).isHost, { timeout: 20000 }).toBe(true)
        expect(await a.page.evaluate(() => (window as any).leaveComplete)).toBe(false)
        blockLeave = false
        await expect.poll(() => a.page.evaluate(() => (window as any).leaveComplete), { timeout: 10000 }).toBe(true)
        expect((await snapshot(a.page)).connectionState).toBe('disconnected')
    } finally {
        await Promise.all(peers.map(async ({ page, context }) => {
            await context.setOffline(false)
            await context.unroute('**/rooms/leave')
            await page.evaluate(() => (window as any).sdkTest.leave()).catch(() => {})
            await context.close()
        }))
    }
})

test('matching, native return and host migration retain the heap without reclaiming old authority', async ({ browser }) => {
    const peers = await Promise.all([peer(browser), peer(browser)])
    try {
        const [a, b] = peers
        const filter = { run: crypto.randomUUID() }
        await enter(a.page, 'joinOrCreateRoom', { player: { name: 'A' }, maxPlayers: 4, filter })
        await ready(a.page)
        await enter(b.page, 'joinOrCreateRoom', { player: { name: 'B' }, maxPlayers: 4, filter })
        await ready(b.page)
        expect((await snapshot(b.page)).roomId).toBe((await snapshot(a.page)).roomId)
        const oldPlayer = (await snapshot(a.page)).playerId
        await a.page.evaluate(() => (window as any).sdkTest.freeze())
        await expect.poll(async () => (await snapshot(b.page)).world.frozen).toBe(true)
        await a.context.setOffline(true)
        await a.page.evaluate(() => (window as any).sdkTest.drop())
        await expect.poll(async () => (await snapshot(a.page)).isHost).toBe(false)
        await expect.poll(async () => (await snapshot(b.page)).isHost, { timeout: 20000 }).toBe(true)
        await a.context.setOffline(false)
        await ready(a.page)
        const returned = await snapshot(a.page)
        expect(returned.playerId).toBe(oldPlayer)
        expect(returned.isHost).toBe(false)
        expect(returned.world).toEqual((await snapshot(b.page)).world)
        expect(returned.states.some((state: any) => state.connectionState === 'reconnecting' && !state.isReady)).toBe(true)
    } finally {
        await Promise.all(peers.map(async ({ page, context }) => {
            await context.setOffline(false)
            await page.evaluate(() => (window as any).sdkTest.leave()).catch(() => {})
            await context.close()
        }))
    }
})

test('real server crash restores membership and retained world through HTTP rejoin', async ({ browser }) => {
    test.skip(!process.env.MP_SERVER_ROOT, 'Requires the server-owned local-stack.mjs crash hook')
    const peers = await Promise.all([peer(browser), peer(browser)])
    try {
        const [a, b] = peers
        await enter(a.page, 'createRoom', { player: { name: 'A' }, maxPlayers: 4 })
        await ready(a.page)
        const code = await a.page.evaluate(() => (window as any).sdkTest.code())
        await enter(b.page, 'joinRoom', { code, player: { name: 'B' } })
        await ready(b.page)
        await a.page.evaluate(() => (window as any).sdkTest.freeze())
        await expect.poll(async () => (await snapshot(b.page)).world.frozen).toBe(true)
        const before = await Promise.all(peers.map(({ page }) => snapshot(page)))
        const serverRoot = process.env.MP_SERVER_ROOT!
        await promisify(execFile)(process.execPath, [
            path.join(serverRoot, 'scripts/local-stack.mjs'), 'crash-server',
        ], { cwd: serverRoot, timeout: 30000 })
        await expect.poll(async () => {
            const states = await Promise.all(peers.map(({ page }) => snapshot(page)))
            return states.every((state) => state.isReady)
        }, { timeout: 60000 }).toBe(true)
        const after = await Promise.all(peers.map(({ page }) => snapshot(page)))
        expect(after.map((state) => state.playerId)).toEqual(before.map((state) => state.playerId))
        expect(after.map((state) => state.roomId)).toEqual(before.map((state) => state.roomId))
        expect(after[0].world).toEqual(before[0].world)
        expect(after[1].world).toEqual(before[0].world)
        expect(after.filter((state) => state.isHost)).toHaveLength(1)
        peers.forEach(({ requests }) => expect(requests.some((request) => request.endsWith('/rooms/rejoin'))).toBe(true))
        const follower = peers[after.findIndex((state) => !state.isHost)]
        await follower.page.evaluate(() => (window as any).sdkTest.send(3))
        await expect.poll(async () => (await snapshot(a.page)).world.counter).toBe(before[0].world.counter + 3)
    } finally {
        await Promise.all(peers.map(async ({ page, context }) => {
            await page.evaluate(() => (window as any).sdkTest.leave()).catch(() => {})
            await context.close()
        }))
    }
})
