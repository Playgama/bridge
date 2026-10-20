import { defineConfig } from '@playwright/test'

if (!process.env.MP_API_BASE || !process.env.MP_PUBLIC_TOKEN) {
    throw new Error('Real E2E requires MP_API_BASE and MP_PUBLIC_TOKEN from the API/server stand; fixtures are not accepted')
}

export default defineConfig({
    testDir: '.',
    testMatch: '*.e2e.ts',
    timeout: 90000,
    workers: 1,
    fullyParallel: false,
    reporter: 'list',
    outputDir: 'test-results/multiplayer',
    use: {
        baseURL: 'http://127.0.0.1:4178',
        headless: true,
        launchOptions: {
            executablePath: process.env.MP_BROWSER_PATH || '/usr/bin/google-chrome',
        },
        // Never capture credentials, invitation codes or reservation URLs in traces.
        trace: 'off',
        screenshot: 'off',
        video: 'off',
    },
    webServer: {
        command: 'python3 -m http.server 4178 --bind 127.0.0.1',
        cwd: '../..',
        url: 'http://127.0.0.1:4178/examples/multiplayer/harness.html',
        reuseExistingServer: false,
    },
})
