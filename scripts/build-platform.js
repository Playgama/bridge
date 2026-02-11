const { execSync } = require('child_process')

const platform = process.argv[2]

if (!platform) {
    console.error('Usage: npm run build:platform -- <platform_name>')
    process.exit(1)
}

execSync(`npx webpack --env platform=${platform}`, { stdio: 'inherit' })
