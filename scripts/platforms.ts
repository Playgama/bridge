import fs from 'fs'
import path from 'path'

const source = fs.readFileSync(
    path.resolve(__dirname, '../src/platformImports.ts'),
    'utf-8',
)

const ids = [...source.matchAll(/__INCLUDE_(\w+)__/g)].map((m) => m[1].toLowerCase())
export const ALL_PLATFORM_IDS: string[] = Array.from(new Set(ids))
