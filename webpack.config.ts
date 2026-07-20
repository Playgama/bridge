import path from 'path'
import fs from 'fs'
import webpack, { Configuration, Compiler } from 'webpack'
import 'webpack-dev-server'
import ESLintPlugin from 'eslint-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'
import packageJson from './package.json'
import { ALL_PLATFORM_IDS } from './scripts/platforms'

const platformDirName = 'platform-bridges'

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
        ...noLint ? [] : [new ESLintPlugin({ extensions: ['js', 'ts', 'tsx'] })],
        new webpack.DefinePlugin({
            PLUGIN_VERSION: JSON.stringify(packageJson.version),
            // Kept as the historical, unscoped plugin name so it stays stable
            // regardless of the npm package name (which is scoped: @playgama/bridge).
            // This value is reported to platform SDKs (e.g. Yandex telemetry).
            PLUGIN_NAME: JSON.stringify('playgama-bridge'),
            ...createPlatformDefines(targetPlatforms),
        }),
    ],
    devServer: {
        port: 3535,
    },
})

interface WebpackEnv {
    platform?: string
    noLint?: boolean
    // Build the npm-consumable bundles (ESM + UMD) instead of the CDN builds.
    npm?: boolean
    // Absolute URL the dynamic bundle uses to fetch its platform-bridges/ chunks.
    // Should match the deploy location, e.g. https://<domain>/v<major>/<channel>/
    publicPath?: string
}

interface WebpackArgv {
    mode?: string
}

export default (env: WebpackEnv = {}, argv: WebpackArgv = {}): Configuration | Configuration[] => {
    const targetPlatform = env.platform || ''
    const targetPlatforms = targetPlatform ? targetPlatform.split(',') : []
    const noLint = Boolean(env.noLint)
    const isDevelopment = argv.mode === 'development'

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

    // npm-consumable bundles. Same source, but with a real module export
    // (src/npm.ts) so `import bridge from '@playgama/bridge'` works. Everything
    // is inlined into a single file (no platform-bridges/ chunks to fetch).
    if (env.npm) {
        const singleChunk = new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })

        const npmEsmConfig: Configuration = {
            ...baseConfig,
            name: 'npm-esm',
            entry: './src/npm',
            experiments: { outputModule: true },
            output: {
                filename: 'playgama-bridge.esm.js',
                path: path.resolve(__dirname, 'dist'),
                library: { type: 'module' },
            },
            plugins: [...(baseConfig.plugins ?? []), singleChunk],
        }

        const npmUmdConfig: Configuration = {
            ...baseConfig,
            name: 'npm-umd',
            entry: './src/npm',
            output: {
                filename: 'playgama-bridge.umd.js',
                path: path.resolve(__dirname, 'dist'),
                library: { name: 'bridge', type: 'umd' },
                globalObject: 'this',
            },
            plugins: [...(baseConfig.plugins ?? []), singleChunk],
        }

        return [npmEsmConfig, npmUmdConfig]
    }

    return [dynamicConfig, bundledConfig]
}
