# Playgama Bridge
One SDK for cross-platform publishing HTML5 games.

## Installation

### Script tag

```html
<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>
```

### npm

```bash
npm i @playgama/bridge
```

With Vite, add the plugin:

```js
// vite.config.js
import playgamaBridge from '@playgama/bridge/vite'

export default {
    base: './',
    plugins: [playgamaBridge()],
}
```

Without Vite, add the script tag above to `index.html` before your game script.

```ts
import bridge from '@playgama/bridge'
```

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
