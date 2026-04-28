// Ambient declarations for build-time globals injected by webpack.DefinePlugin
// and for window-attached singletons exposed by Playgama Bridge.

declare global {
    const PLUGIN_VERSION: string
    const PLUGIN_NAME: string

    const __INCLUDE_VK__: boolean
    const __INCLUDE_OK__: boolean
    const __INCLUDE_YANDEX__: boolean
    const __INCLUDE_CRAZY_GAMES__: boolean
    const __INCLUDE_ABSOLUTE_GAMES__: boolean
    const __INCLUDE_GAME_DISTRIBUTION__: boolean
    const __INCLUDE_PLAYGAMA__: boolean
    const __INCLUDE_PLAYDECK__: boolean
    const __INCLUDE_TELEGRAM__: boolean
    const __INCLUDE_Y8__: boolean
    const __INCLUDE_LAGGED__: boolean
    const __INCLUDE_FACEBOOK__: boolean
    const __INCLUDE_POKI__: boolean
    const __INCLUDE_QA_TOOL__: boolean
    const __INCLUDE_MSN__: boolean
    const __INCLUDE_MICROSOFT_STORE__: boolean
    const __INCLUDE_HUAWEI__: boolean
    const __INCLUDE_BITQUEST__: boolean
    const __INCLUDE_GAMEPUSH__: boolean
    const __INCLUDE_DISCORD__: boolean
    const __INCLUDE_JIO_GAMES__: boolean
    const __INCLUDE_YOUTUBE__: boolean
    const __INCLUDE_PORTAL__: boolean
    const __INCLUDE_REDDIT__: boolean
    const __INCLUDE_XIAOMI__: boolean
    const __INCLUDE_TIKTOK__: boolean
    const __INCLUDE_DLIGHTEK__: boolean
    const __INCLUDE_GAMESNACKS__: boolean

    interface Window {
        bridge?: unknown
        playgamaBridge?: unknown
        adsbygoogle?: unknown[] & { push?: (config: Record<string, unknown>) => unknown }
        system?: { postMessage: (message: unknown) => void }
        chrome?: {
            webview?: {
                postMessage: (message: unknown) => void
            }
        }
    }
}

export {}
