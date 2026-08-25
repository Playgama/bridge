/* eslint-disable max-classes-per-file */
import path from 'path'
import fs from 'fs'
import webpack, { Configuration, Compiler } from 'webpack'
import 'webpack-dev-server'
import ESLintPlugin from 'eslint-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import packageJson from './package.json'
import { ALL_PLATFORM_IDS } from './scripts/platforms'

const platformDirName = 'platform-bridges'

// What the SDK calls itself when it reports to a platform (Yandex reads it as
// `pluginName`). Deliberately not `packageJson.name`: the package is published
// under the scoped `@playgama/bridge`, and renaming the plugin in the analytics
// of every game as a side effect of packaging would be a lie about which SDK
// is running.
const PLUGIN_NAME = 'playgama-bridge'

class CleanPlatformsPlugin {
    apply(compiler: Compiler): void {
        compiler.hooks.beforeRun.tap('CleanPlatformsPlugin', () => {
            const platformsDir = path.resolve(__dirname, `dist/${platformDirName}`)
            if (fs.existsSync(platformsDir)) {
                fs.rmSync(platformsDir, { recursive: true })
            }
        })
    }
}

// Fork: mirror build artifacts into UnityTemplate/ so the Unity WebGL template
// always ships the freshly built bridge.
class CopyToUnityTemplatePlugin {
    apply(compiler: Compiler): void {
        compiler.hooks.afterEmit.tap('CopyToUnityTemplatePlugin', () => {
            const distDir = path.resolve(__dirname, 'dist')
            const destDir = path.resolve(__dirname, 'UnityTemplate')

            const mainSrc = path.join(distDir, 'playgama-bridge.js')
            if (fs.existsSync(mainSrc)) {
                fs.copyFileSync(mainSrc, path.join(destDir, 'playgama-bridge.js'))
                // eslint-disable-next-line no-console
                console.log('Copied playgama-bridge.js → UnityTemplate/')
            }

            const platformsSrc = path.join(distDir, platformDirName)
            const platformsDest = path.join(destDir, platformDirName)
            if (fs.existsSync(platformsSrc)) {
                if (fs.existsSync(platformsDest)) {
                    fs.rmSync(platformsDest, { recursive: true })
                }
                fs.cpSync(platformsSrc, platformsDest, { recursive: true })
                // eslint-disable-next-line no-console
                console.log(`Copied ${platformDirName}/ → UnityTemplate/`)
            }
        })
    }
}

const createPlatformDefines = (targetPlatforms: string[]): Record<string, boolean> => {
    const includeAll = targetPlatforms.length === 0
    return Object.fromEntries(
        ALL_PLATFORM_IDS.map((id) => [
            `__INCLUDE_${id.toUpperCase()}__`,
            includeAll || targetPlatforms.includes(id),
        ]),
    )
}

interface CreateConfigOptions {
    noLint?: boolean
}

const createConfig = (targetPlatforms: string[] = [], { noLint = false }: CreateConfigOptions = {}): Configuration => ({
    mode: 'production',
    entry: './src/index',
    output: {
        filename: 'playgama-bridge.js',
        chunkFilename: (pathData) => {
            const chunkId = String(pathData.chunk?.id || pathData.chunk?.name || '')
            const platformDirNameRegex = new RegExp(`${platformDirName}_(\\w+)_(?:ts|js)`)
            const match = chunkId.match(platformDirNameRegex)
            if (match) {
                const name = match[1]
                    .replace(/PlatformBridge/, '')
                    .replace(/([A-Z])/g, '-$1')
                    .replace(/-/g, '')
                    .toLowerCase()
                return `${platformDirName}/${name}.js`
            }
            return `${platformDirName}/${chunkId}.js`
        },
        path: path.resolve(__dirname, 'dist'),
        publicPath: 'auto',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.mjs'],
    },
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: /\.tsx?$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                    },
                },
            },
        ],
    },
    optimization: {
        chunkIds: 'named',
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
            }),
        ],
        splitChunks: {
            chunks: 'async',
            cacheGroups: {
                default: false,
                defaultVendors: false,
            },
        },
    },
    plugins: [
        new CleanPlatformsPlugin(),
        new CopyToUnityTemplatePlugin(),
        ...noLint ? [] : [new ESLintPlugin({ extensions: ['js', 'ts', 'tsx'] })],
        new webpack.DefinePlugin({
            PLUGIN_VERSION: JSON.stringify(packageJson.version),
            PLUGIN_NAME: JSON.stringify(PLUGIN_NAME),
            ...createPlatformDefines(targetPlatforms),
        }),
    ],
    devServer: {
        port: 3535,
    },
})

// Fork: the npm package. `dist/playgama-bridge.js` is a <script> bundle whose
// only export is the `window.bridge` it creates; a game that writes
// `import { bridge } from '@playgama/bridge'` needs real module output instead.
//
// Every npm bundle is a bundled one: platform bridges are inlined rather than
// split into async chunks. A chunk would be fetched at runtime from a
// publicPath the consumer's own bundler knows nothing about, and the game would
// fail to find its platform on the very first launch.
type NpmLibraryType = 'module' | 'umd' | 'commonjs2'

interface NpmBundle {
    name: string
    entry: string
    filename: string
    library: NpmLibraryType
}

const NPM_BUNDLES: NpmBundle[] = [
    {
        name: 'npm-esm', entry: './src/npm', filename: 'playgama-bridge.esm.js', library: 'module',
    },
    {
        name: 'npm-umd', entry: './src/npm', filename: 'playgama-bridge.umd.js', library: 'umd',
    },
    {
        name: 'npm-constants-esm', entry: './src/constantsEntry', filename: 'constants.esm.js', library: 'module',
    },
    {
        name: 'npm-constants-cjs', entry: './src/constantsEntry', filename: 'constants.cjs.js', library: 'commonjs2',
    },
]

const createNpmConfig = (bundle: NpmBundle, { noLint = false }: CreateConfigOptions = {}): Configuration => {
    const base = createConfig([], { noLint })
    return {
        ...base,
        name: bundle.name,
        entry: bundle.entry,
        output: {
            filename: bundle.filename,
            path: path.resolve(__dirname, 'dist'),
            publicPath: 'auto',
            library: bundle.library === 'module'
                ? { type: 'module' }
                : { name: bundle.library === 'umd' ? 'bridge' : undefined, type: bundle.library },
        },
        ...bundle.library === 'module' ? { experiments: { outputModule: true } } : {},
        // The shared plugin list is deliberately not reused: it mirrors the build
        // into UnityTemplate/ and wipes dist/platform-bridges/, and neither has
        // anything to do with a package published to npm.
        plugins: [
            new webpack.DefinePlugin({
                PLUGIN_VERSION: JSON.stringify(packageJson.version),
                PLUGIN_NAME: JSON.stringify(PLUGIN_NAME),
                ...createPlatformDefines([]),
            }),
            new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
        ],
    }
}

interface WebpackEnv {
    platform?: string
    noLint?: boolean
    // Absolute URL the dynamic bundle uses to fetch its platform-bridges/ chunks.
    // Should match the deploy location, e.g. https://<domain>/v<major>/<channel>/
    publicPath?: string
    // Fork: build the npm package (ESM/UMD + constants entry) instead of the
    // <script> bundles.
    npm?: boolean
}

interface WebpackArgv {
    mode?: string
}

export default (env: WebpackEnv = {}, argv: WebpackArgv = {}): Configuration | Configuration[] => {
    const targetPlatform = env.platform || ''
    const targetPlatforms = targetPlatform ? targetPlatform.split(',') : []
    const noLint = Boolean(env.noLint)
    const isDevelopment = argv.mode === 'development'

    if (env.npm) {
        return NPM_BUNDLES.map((bundle) => createNpmConfig(bundle, { noLint }))
    }

    if (targetPlatforms.length > 0) {
        const config = createConfig(targetPlatforms, { noLint })
        return {
            ...config,
            name: 'platform',
            output: {
                filename: 'playgama-bridge.js',
                path: path.resolve(__dirname, 'dist'),
                publicPath: 'auto',
            },
            plugins: [
                ...(config.plugins ?? []),
                new webpack.optimize.LimitChunkCountPlugin({
                    maxChunks: 1,
                }),
            ],
        }
    }

    const baseConfig = createConfig([], { noLint })

    const dynamicConfig: Configuration = {
        ...baseConfig,
        name: 'dynamic',
        output: {
            ...baseConfig.output,
            publicPath: isDevelopment ? 'auto' : env.publicPath,
        },
        plugins: [
            ...(baseConfig.plugins ?? []),
        ],
    }

    const bundledConfig: Configuration = {
        ...baseConfig,
        name: 'bundled',
        plugins: [
            ...(baseConfig.plugins ?? []),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 1,
            }),
        ],
    }

    return [dynamicConfig, bundledConfig]
}
