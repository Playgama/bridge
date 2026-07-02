const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ALL_PLATFORM_IDS } = require('./platforms')

const DIST_DIR = path.resolve(__dirname, '../dist')
const OUT_DIR = path.join(DIST_DIR, 'publish')
const BUILT_FILE = path.join(DIST_DIR, 'playgama-bridge.js')

const args = process.argv.slice(2)

const getArg = (name) => {
    const prefix = `--${name}=`
    const arg = args.find((a) => a.startsWith(prefix))
    return arg ? arg.slice(prefix.length) : undefined
}

if (args.includes('--help') || args.includes('--list')) {
    console.info('Usage: node scripts/build-dist.js --scope=all|base|platforms [--platform=<id>]')
    console.info('Available platforms:', ALL_PLATFORM_IDS.join(', '))
    process.exit(0)
}

const scope = getArg('scope') || 'all'
if (!['all', 'base', 'platforms'].includes(scope)) {
    console.error(`Unknown scope: ${scope}. Use one of: all, base, platforms`)
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

const collect = (targetName) => {
    if (!fs.existsSync(BUILT_FILE)) {
        console.error(`Expected build output not found: ${BUILT_FILE}`)
        process.exit(1)
    }
    const dest = path.join(OUT_DIR, targetName)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(BUILT_FILE, dest)
    const { size } = fs.statSync(dest)
    console.info(`-> ${targetName} (${(size / 1024).toFixed(1)} KB)`)
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const buildBase = scope === 'all' || scope === 'base'
const buildPlatforms = scope === 'all' || scope === 'platforms'

if (buildBase) {
    console.info('\n=== Building base bundle (all platforms) ===')
    run('npx webpack --config-name bundled --env noLint')
    collect('playgama-bridge.js')
}

if (buildPlatforms) {
    const platforms = singlePlatform ? [singlePlatform] : ALL_PLATFORM_IDS
    console.info(`\n=== Building ${platforms.length} per-platform bundle(s) ===`)
    for (const id of platforms) {
        console.info(`\n--- ${id} ---`)
        run(`npx webpack --env platform=${id} --env noLint`)
        collect(path.join('platform-bridges', `${id}.js`))
    }
}

const produced = fs.readdirSync(OUT_DIR, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .sort()
console.info(`\n=== Done. ${produced.length} file(s) in dist/publish/ ===`)
produced.forEach((name) => console.info(`  ${name.split(path.sep).join('/')}`))
