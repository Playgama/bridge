const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
    path.resolve(__dirname, '../src/platformImports.js'),
    'utf-8',
)

const ALL_PLATFORM_IDS = []
const regex = /__INCLUDE_(\w+)__/g
let match
while ((match = regex.exec(source)) !== null) {
    const id = match[1].toLowerCase()
    if (!ALL_PLATFORM_IDS.includes(id)) {
        ALL_PLATFORM_IDS.push(id)
    }
}

// Platforms that must always be bundled together with the key platform.
const PLATFORM_BUNDLE_EXTRAS = {
    playgama: ['standalone'],
}

const expandPlatforms = (platforms) => Array.from(
    new Set(platforms.flatMap((id) => [id, ...(PLATFORM_BUNDLE_EXTRAS[id] || [])])),
)

module.exports = { ALL_PLATFORM_IDS, expandPlatforms }
