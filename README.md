# Playgama Bridge
One SDK for cross-platform publishing HTML5 games.

## Installation

### Script tag

```html
<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>
```

The SDK is available as `window.bridge`. Put `playgama-bridge-config.json` next to `index.html`.

### npm + Vite

```bash
npm i @playgama/bridge
```

```js
// vite.config.js
import playgamaBridge from '@playgama/bridge/vite'

export default {
    base: './',
    plugins: [playgamaBridge()],
}
```

```ts
import bridge, { PLATFORM_ID } from '@playgama/bridge'

await bridge.initialize()
```

The plugin injects the SDK `<script>` into `index.html` and writes `playgama-bridge.js` next to the game files, so the SDK is never bundled into the game code. The `@playgama/bridge` import returns that same `window.bridge` instance with full typings.

#### Loading modes

| `mode` | Script tag | Runtime version |
| --- | --- | --- |
| `cdn` (default) | the CDN, with the local file as a fallback | whatever `v2/stable` serves, so fixes arrive without a rebuild |
| `local` | the local file only | the version installed from npm |

Pass the mode as `playgamaBridge({ mode: 'local' })`. In `cdn` mode the runtime version can differ from the installed package, which is exactly what makes updates automatic. Choose `local` when a build has to stay reproducible.

#### Notes

- Keep `base` relative (`'./'`) or a site-root path such as `'/my-game/'`. An absolute URL points the local fallback at your own host, and platform builds cannot rewrite it.
- Remove your own `<script>` tag for the SDK if you had one. The plugin skips injection when it finds a tag and warns about it, so nothing breaks, but the tag is then yours to maintain.
- A `playgama-bridge.js` in `public/` is ignored in favour of the packaged copy, with a warning. Delete it.
- There is no `window` on a server, in a worker or in tests, so import from `@playgama/bridge/constants` there. That entry carries the constants and the types with no runtime.

#### Upgrading from 2.2.0 or earlier

Earlier versions inlined the whole SDK into the game code on `import`. The import now returns the runtime that a `<script>` tag has loaded, so add the Vite plugin or the tag; without either, the import throws and the message says what to do. The UMD build `dist/playgama-bridge.umd.js` is gone, and `require('@playgama/bridge')` resolves to `dist/playgama-bridge.cjs.js`.

### Other bundlers

Add the script tag yourself and copy `node_modules/@playgama/bridge/dist/playgama-bridge.js` into the build output.

## Supported platforms
+ [Playgama](https://playgama.com/?utm_source=github&utm_medium=bridge)
+ [Standalone](https://playgama.com/wrap/?utm_source=github&utm_medium=bridge)
+ [Game Distribution](https://gamedistribution.com)
+ [Crazy Games](https://crazygames.com)
+ [Yandex Games](https://yandex.com/games)
+ [Y8](https://y8.com)
+ [Telegram](https://core.telegram.org/bots/webapps)
+ [VK](https://vk.com)
+ [OK](https://ok.ru)
+ [Lagged](https://lagged.com)
+ [Facebook](https://www.facebook.com/games/instantgames)
+ [Poki](https://poki.com/)
+ [MSN](https://www.msn.com/en-us/play)
+ [Discord](https://discord.com/gaming)
+ [Huawei](https://appgallery.huawei.com)
+ [JioGames](https://play.jiogames.com)
+ [YouTube](https://www.youtube.com/playables)
+ [Reddit](https://www.reddit.com/r/GamesOnReddit/)
+ [Xiaomi](https://global.app.mi.com/details?lo=ES&la=en&id=com.xiaomi.glgm)
+ [Microsoft Store](https://apps.microsoft.com)
+ [GameSnacks](https://gamesnacks.com/)
+ [Dlightek/Aha Games](https://aha.game/)
+ [Portal](https://portalapp.games)
+ [TikTok](https://developers.tiktok.com/doc/mini-games-sdk-overview)
+ [Samsung Instant Plays](https://developer.samsung.com/instant-plays)
+ Other [Work In Progress]

## Plugins for game engines
+ [JS](https://github.com/playgama/bridge)
+ [Construct 3](https://github.com/playgama/bridge-construct)
+ Unity [Plugin](https://github.com/playgama/bridge-unity) | [Examples](https://github.com/playgama/bridge-unity-examples)
+ [Godot 3](https://github.com/playgama/bridge-godot)
+ [Godot 4](https://github.com/playgama/bridge-godot-4)
+ [GameMaker](https://github.com/playgama/bridge-gamemaker)
+ [Defold](https://github.com/playgama/bridge-defold)
+ [GDevelop](https://github.com/playgama/bridge-gdevelop)
+ [Cocos Creator](https://github.com/playgama/bridge-cocos-creator)
+ [Scratch](https://github.com/playgama/bridge-scratch)

## Useful links
+ [Documentation](https://wiki.playgama.com/?utm_source=github&utm_medium=bridge)
+ [Discord](https://discord.gg/pzqd2upxr8)
+ [Game Publishing](https://developer.playgama.com/?utm_source=github&utm_medium=bridge)

## License
This project is licensed under the terms of the GNU Lesser General Public License v3.0. See the [LICENSE](LICENSE) file for details.
