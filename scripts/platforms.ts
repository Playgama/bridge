import fs from 'fs'
import path from 'path'

const source = fs.readFileSync(
    path.resolve(__dirname, '../src/platformImports.ts'),
    'utf-8',
)

const ids = [...source.matchAll(/__INCLUDE_(\w+)__/g)].map((m) => m[1].toLowerCase())
export const ALL_PLATFORM_IDS: string[] = Array.from(new Set(ids))

// Platforms that must always be bundled together with the key platform.
const PLATFORM_BUNDLE_EXTRAS: Record<string, string[]> = {
    playgama: ['standalone'],
}

export const expandPlatforms = (platforms: string[]): string[] => Array.from(
    new Set(platforms.flatMap((id) => [id, ...PLATFORM_BUNDLE_EXTRAS[id] ?? []])),
)
