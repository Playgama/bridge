import { defineConfig } from 'vitest/config'
import fs from 'fs'

const source = fs.readFileSync('./src/platformImports.js', 'utf-8')
const platformDefines = {}
const regex = /__INCLUDE_(\w+)__/g
let match
while ((match = regex.exec(source)) !== null) {
    platformDefines[`__INCLUDE_${match[1]}__`] = true
}

export default defineConfig({
    define: platformDefines,
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
        globals: true,
    },
})
