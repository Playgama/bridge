const path = require('path')
const webpack = require('webpack')
const ESLintPlugin = require('eslint-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const packageJson = require('./package.json')

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'playgama-bridge.js',
        chunkFilename: (pathData) => {
            const chunkId = String(pathData.chunk.id || pathData.chunk.name || '')
            const match = chunkId.match(/platform-bridges_(\w+)_js/)

            if (match) {
                const name = match[1]
                    .replace(/PlatformBridge/, '')
                    .replace(/([A-Z])/g, '-$1')
                    .toLowerCase()
                    .replace(/^-/, '')
                return `platforms-bridges/${name}.platform-bridge.js`
            }
            return `platforms-bridges/${chunkId}.js`
        },
        path: path.resolve(__dirname, 'dist'),
        publicPath: 'auto',
        clean: {
            keep: (asset) => {
                if (asset.startsWith('platforms-bridges/')) {
                    return false
                }
                return true
            },
        },
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
        ],
    },
    optimization: {
        chunkIds: 'named',
        minimizer: [
            new TerserPlugin({
                extractComments: false,
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
        new ESLintPlugin(),
        new webpack.DefinePlugin({
            PLUGIN_VERSION: JSON.stringify(packageJson.version),
            PLUGIN_NAME: JSON.stringify(packageJson.name),
        }),
    ],
    devServer: {
        port: 3535,
    },
}
