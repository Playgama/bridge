import { defineConfig } from 'vitest/config'
import fs from 'fs'

const source = fs.readFileSync('./src/platformImports.ts', 'utf-8')
const platformDefines: Record<string, string> = Object.fromEntries(
    [...source.matchAll(/__INCLUDE_(\w+)__/g)].map((m) => [`__INCLUDE_${m[1]}__`, 'true']),
)

export default defineConfig({
    define: platformDefines,
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
        globals: true,
    },
})
