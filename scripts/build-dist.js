const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ALL_PLATFORM_IDS } = require('./platforms')

const DIST_DIR = path.resolve(__dirname, '../dist')
const OUT_DIR = path.join(DIST_DIR, 'publish')
const BUILT_FILE = path.join(DIST_DIR, 'playgama-bridge.js')
const CHUNKS_DIR = path.join(DIST_DIR, 'platform-bridges')

const args = process.argv.slice(2)

const getArg = (name) => {
    const prefix = `--${name}=`
    const arg = args.find((a) => a.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : undefined
}

if (args.includes('--help') || args.includes('--list')) {
    console.info('Usage: node scripts/build-dist.js [--type=both|dynamic|standalone] [--platform=<id>] [--public-path=<url>]')
    console.info('Available platforms:', ALL_PLATFORM_IDS.join(', '))
    process.exit(0)
}

// Absolute URL the dynamic bundle uses to fetch its platform-bridges/ chunks.
// Should match the deploy location, e.g. https://<domain>/v<major>/<channel>/
const publicPath = getArg('public-path')

const type = getArg('type') || 'both'
if (!['both', 'dynamic', 'standalone'].includes(type)) {
    console.error(`Unknown type: ${type}. Use one of: both, dynamic, standalone`)
    process.exit(1)
}

const singlePlatform = getArg('platform')
if (singlePlatform && !ALL_PLATFORM_IDS.includes(singlePlatform)) {
    console.error(`Unknown platform: ${singlePlatform}`)
    console.error(`Available: ${ALL_PLATFORM_IDS.join(', ')}`)
    process.exit(1)
}

const run = (command) => {
    console.info(`\n$ ${command}`)
    execSync(command, { stdio: 'inherit' })
}

const ensureBuilt = () => {
    if (!fs.existsSync(BUILT_FILE)) {
        console.error(`Expected build output not found: ${BUILT_FILE}`)
        process.exit(1)
    }
}

const collect = (src, relDest) => {
    const dest = path.join(OUT_DIR, relDest)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    const { size } = fs.statSync(dest)
    console.info(`-> ${relDest.split(path.sep).join('/')} (${(size / 1024).toFixed(1)} KB)`)
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const buildDynamic = type === 'both' || type === 'dynamic'
const buildStandalone = type === 'both' || type === 'standalone'

if (buildDynamic && !publicPath) {
    console.error('--public-path=<url> is required when building the dynamic bundle')
    console.error('e.g. --public-path=https://bridge.playgama.com/v1/stable/')
    process.exit(1)
}

// Dynamic first: it writes dist/platform-bridges/ which later standalone builds wipe.
if (buildDynamic) {
    console.info('\n=== Building dynamic bundle (main + platform chunks) ===')
    const publicPathArg = publicPath ? ` --env publicPath=${publicPath}` : ''
    run(`npx webpack --config-name dynamic --env noLint${publicPathArg}`)
    ensureBuilt()
    collect(BUILT_FILE, 'playgama-bridge.js')
    if (!fs.existsSync(CHUNKS_DIR)) {
        console.error(`Expected chunks dir not found: ${CHUNKS_DIR}`)
        process.exit(1)
    }
    fs.cpSync(CHUNKS_DIR, path.join(OUT_DIR, 'platform-bridges'), { recursive: true })
    const chunks = fs.readdirSync(CHUNKS_DIR).filter((n) => n.endsWith('.js'))
    console.info(`-> platform-bridges/ (${chunks.length} chunk file(s))`)
}

if (buildStandalone) {
    const platforms = singlePlatform ? [singlePlatform] : ALL_PLATFORM_IDS
    console.info(`\n=== Building ${platforms.length} standalone bundle(s) ===`)
    platforms.forEach((id) => {
        console.info(`\n--- ${id} ---`)
        run(`npx webpack --env platform=${id} --env noLint`)
        ensureBuilt()
        collect(BUILT_FILE, path.join('standalone', id, 'playgama-bridge.js'))
    })
}

const produced = fs.readdirSync(OUT_DIR, { recursive: true })
    .filter((name) => typeof name === 'string' && name.endsWith('.js'))
    .sort()
console.info(`\n=== Done. ${produced.length} file(s) in dist/publish/ ===`)
produced.forEach((name) => console.info(`  ${name.split(path.sep).join('/')}`))
