import type { Plugin } from 'vite'

export interface PlaygamaBridgePluginOptions {
    mode?: 'cdn' | 'local'
}

declare function playgamaBridge(options?: PlaygamaBridgePluginOptions): Plugin

export default playgamaBridge
export { playgamaBridge }
