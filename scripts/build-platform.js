const { execSync } = require('child_process')
const { ALL_PLATFORM_IDS } = require('./platforms')

const args = process.argv.slice(2)

if (args.includes('--list')) {
    console.info('Available platforms:', ALL_PLATFORM_IDS.join(', '))
    process.exit(0)
}

const platform = args.find((arg) => !arg.startsWith('--'))

if (!platform) {
    console.error('Usage: npm run build:platform -- <platform1,platform2,...> [--no-lint] [--list]')
    process.exit(1)
}

const platforms = platform.split(',')
const invalid = platforms.filter((p) => !ALL_PLATFORM_IDS.includes(p))
if (invalid.length > 0) {
    console.error(`Unknown platform(s): ${invalid.join(', ')}`)
    console.error(`Available: ${ALL_PLATFORM_IDS.join(', ')}`)
    process.exit(1)
}

const noLint = args.includes('--no-lint') ? ' --env noLint' : ''
execSync(`npx webpack --env platform=${platform}${noLint}`, { stdio: 'inherit' })
