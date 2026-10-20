const fs = require('node:fs')
const path = require('node:path')

const FILE_NAME = 'playgama-bridge.js'
const CDN_ORIGIN = 'https://bridge.playgama.com'
const RUNTIME_PATH = path.resolve(__dirname, '..', 'dist', FILE_NAME)
const MODES = ['cdn', 'local']
const EXISTING_TAG_REGEX = /<script[^>]+src\s*=\s*["'][^"']*playgama-bridge\.js(?:\?[^"']*)?["']/i

function playgamaBridge(options = {}) {
    const mode = options.mode || 'cdn'

    if (!MODES.includes(mode)) {
        throw new Error(`[playgama-bridge] Unknown mode "${mode}". Expected one of: ${MODES.join(', ')}`)
    }

    if (!fs.existsSync(RUNTIME_PATH)) {
        throw new Error(`[playgama-bridge] Runtime not found at ${RUNTIME_PATH}. The @playgama/bridge package is incomplete, reinstall it.`)
    }

    const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'))
    const cdnSrc = `${CDN_ORIGIN}/v${version.split('.')[0]}/stable/${FILE_NAME}`
    let base = '/'
    let logger = console

    const localSrc = () => `${base}${FILE_NAME}`

    return {
        name: 'playgama-bridge',

        configResolved(config) {
            base = config.base
            logger = config.logger

            if (config.publicDir && fs.existsSync(path.join(config.publicDir, FILE_NAME))) {
                logger.warn(`[playgama-bridge] ${FILE_NAME} in the public directory is ignored: the build gets the copy shipped with @playgama/bridge. Delete it to silence this warning.`)
            }
        },

        transformIndexHtml(html) {
            // A game that already loads the SDK itself keeps its own tag: injecting a
            // second one downloads the runtime twice and leaves duplicate tags for the
            // Playgama build tool to rewrite.
            if (EXISTING_TAG_REGEX.test(html)) {
                logger.warn(`[playgama-bridge] index.html already loads ${FILE_NAME}, no script tag injected. Remove that tag to let the plugin manage it.`)
                return []
            }

            if (mode === 'local') {
                return [{ tag: 'script', attrs: { src: localSrc() }, injectTo: 'head-prepend' }]
            }

            return [
                { tag: 'script', attrs: { src: cdnSrc }, injectTo: 'head-prepend' },
                {
                    tag: 'script',
                    children: `window.bridge || document.write('<script src="${localSrc()}"><\\/script>');`,
                    injectTo: 'head-prepend',
                },
            ]
        },

        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if ((req.url || '').split('?')[0] !== localSrc()) {
                    next()
                    return
                }

                res.setHeader('Content-Type', 'application/javascript')
                fs.createReadStream(RUNTIME_PATH).pipe(res)
            })
        },

        generateBundle() {
            this.emitFile({ type: 'asset', fileName: FILE_NAME, source: fs.readFileSync(RUNTIME_PATH) })
        },
    }
}

module.exports = playgamaBridge
module.exports.default = playgamaBridge
module.exports.playgamaBridge = playgamaBridge
