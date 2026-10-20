// Packaging-only browser smoke. HTTP is deliberately rejected; this is not a multiplayer E2E test.
// Run after an ordinary build: node tests/multiplayer-browser/packaging.mjs [artifact-directory]
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const root = path.resolve(process.argv[2] || 'dist')
const origin = 'http://127.0.0.1:4179'
const base = '/game/'
const browser = await chromium.launch({
    executablePath: process.env.MP_BROWSER_PATH || '/usr/bin/google-chrome',
})
try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const requests = []
    const errors = []
    let missing = true
    page.on('pageerror', (error) => errors.push(error.message))
    await context.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        assert.equal(url.origin, origin, 'Packaging smoke must not contact an external service')
        requests.push(url.pathname)
        if (url.pathname === `${base}index.html`) {
            await route.fulfill({
                contentType: 'text/html',
                body: '<script src="./playgama-bridge.js?build=packaging"></script>',
            })
        } else if (url.pathname === '/api/sessions') {
            await route.fulfill({
                status: 400, contentType: 'application/json',
                body: '{"error":{"code":"PACKAGING_RUNTIME_LOADED"}}',
            })
        } else if (missing && url.pathname === `${base}platform-bridges/multiplayer.js`) {
            await route.fulfill({ status: 404, body: '' })
        } else if (url.pathname.startsWith(base)) {
            try {
                await route.fulfill({
                    contentType: 'application/javascript',
                    body: await fs.readFile(path.join(root, url.pathname.slice(base.length))),
                })
            } catch {
                await route.fulfill({ status: 404, body: '' })
            }
        } else await route.fulfill({ status: 404, body: '' })
    })
    const initialize = (configured) => page.evaluate(async ({ origin, configured }) => {
        await window.bridge.initialize({
            forciblySetPlatformId: 'mock',
            sendAnalyticsEvents: false,
            disableLoadingLogo: true,
            ...(configured ? { multiplayer: {
                apiBase: `${origin}/api`, appToken: 'packaging-only', environment: 'packaging', region: 'eu',
            } } : {}),
        })
        return Boolean(window.bridge.platform)
    }, { origin, configured })
    const calls = () => page.evaluate(() => Promise.all([1, 2, 3].map(async () => {
        try { await window.bridge.multiplayer.getRooms(); return 'unexpected-success' }
        catch (error) { return error.code || error.name }
    })))
    const chunkCount = () => requests.filter((url) => url === `${base}platform-bridges/multiplayer.js`).length

    await page.goto(`${origin}${base}index.html`)
    assert.equal(await initialize(false), true)
    assert.equal(chunkCount(), 0, 'Ordinary initialization must work without addon')
    assert.deepEqual(await calls(), Array(3).fill('MULTIPLAYER_NOT_CONFIGURED'))
    assert.equal(chunkCount(), 0)
    assert(!requests.includes('/api/sessions'))
    await page.reload()
    assert.equal(await initialize(true), true)
    assert.equal(chunkCount(), 0, 'Configured initialization must also stay lazy')
    assert.deepEqual(await calls(), Array(3).fill('ChunkLoadError'))
    assert.equal(chunkCount(), 1, 'Concurrent calls share the failed chunk load')
    missing = false
    assert.deepEqual(await calls(), Array(3).fill('PACKAGING_RUNTIME_LOADED'))
    assert.equal(chunkCount(), 2, 'A later operation retries loading the missing addon once')
    assert.deepEqual(errors, [])
    await context.close()
    console.info(`PASS packaging lazy-load/missing-retry/concurrency/subdirectory/query: ${root}`)
} finally {
    await browser.close()
}
