<p align="center">
    <a href="https://playgama.com/developers?utm_source=github&utm_medium=bridge"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/banners/bridge.jpg" alt="Playgama Bridge" width="100%"></a>
</p>

<p align="center"><b>One SDK to publish HTML5 games on 20+ web platforms</b></p>

<p align="center">
    <a href="https://www.npmjs.com/package/@playgama/bridge"><img src="https://img.shields.io/npm/v/@playgama/bridge?color=8B5CF6&label=npm" alt="npm"></a>
    <a href="https://github.com/Playgama/bridge/releases/latest"><img src="https://img.shields.io/github/v/release/Playgama/bridge?color=8B5CF6&label=release" alt="Release"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/Playgama/bridge?color=8B5CF6" alt="License"></a>
    <a href="https://wiki.playgama.com/playgama/bridge-sdk/getting-started?utm_source=github&utm_medium=bridge"><img src="https://img.shields.io/badge/docs-wiki.playgama.com-8B5CF6" alt="Documentation"></a>
    <a href="https://discord.gg/pzqd2upxr8"><img src="https://img.shields.io/badge/discord-join-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
</p>

<p align="center">
    <a href="https://wiki.playgama.com/playgama/bridge-sdk/getting-started?utm_source=github&utm_medium=bridge">Documentation</a>
    ·
    <a href="https://discord.gg/pzqd2upxr8">Discord</a>
    ·
    <a href="https://developer.playgama.com/?utm_source=github&utm_medium=bridge">Publish a game</a>
</p>

## Quick start

Add the SDK from CDN (recommended) — only the adapter of the current platform is downloaded:

```html
<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>
```

Or install the npm package for self-contained builds:

```bash
npm i @playgama/bridge
```

```javascript
import bridge from '@playgama/bridge'
```

Put `playgama-bridge-config.json` next to `index.html`. Create it with the [config editor](https://playgama.github.io/bridge-config-editor/).

Initialize the SDK before using any API:

```javascript
bridge.initialize()
    .then(() => {
        // the SDK is ready, start the game
    })
```

### Next steps

Full API — ads, saves, payments, leaderboards and more: [wiki.playgama.com](https://wiki.playgama.com/playgama/bridge-sdk/api?utm_source=github&utm_medium=bridge).

## Developer tools

### Bridge DevTools for Chrome

[Playgama Bridge DevTools](https://chromewebstore.google.com/detail/playgama-bridge-devtools/mldhijegcmagkcchjmenafiipkhjlppo) adds a `Bridge` panel to Chrome DevTools: SDK detection, module state, config, events and analytics calls of the running game. Open the panel, then reload the game page.

### Playgama MCP server

Connect Claude Code, Codex, Cursor or VS Code to your Playgama developer cabinet. The agent can integrate Bridge using the served SDK docs, create a game, upload builds and covers, edit in-app items and leaderboards, and publish a sandbox link to play.

```bash
claude mcp add --transport 'http' 'playgama-developer-cabinet' 'https://developer.playgama.com/api/mcp'
```

Setup for other clients: [MCP guide](https://wiki.playgama.com/playgama/mcp?utm_source=github&utm_medium=bridge).

## Features

| Module | What you get |
| --- | --- |
| **Advertising** | Interstitial, rewarded and banner ads, multiple banner placements, AdBlock detection |
| **In-game purchases** | One product catalog for every platform, consumable and permanent items |
| **Cloud saves** | Player progress stored on the platform or locally with the same API |
| **Leaderboards and achievements** | Score tables and milestones |
| **Tasks and daily rewards** | Daily, weekly and permanent quests, login streak rewards |
| **Social** | Share, invite friends, join community, add to favorites, rate the game |
| **Notifications and cross-promo** | Bring players back and route them between your games |
| **Player and device** | Authorization, profile, device type, orientation, safe area |
| **Platform** | Language, pause and audio events, lifecycle messages, server time |
| **Remote config and analytics** | Tune the game without a release, track your own events |
| **Local development** | Works outside platforms: calls return safe defaults instead of errors |

Full API reference: [wiki.playgama.com](https://wiki.playgama.com/playgama/bridge-sdk/api?utm_source=github&utm_medium=bridge).

## Supported platforms

<table>
    <tr>
        <td align="center" width="120"><a href="https://playgama.com/?utm_source=github&utm_medium=bridge"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/playgama.png" width="48" height="48" alt="Playgama"><br>Playgama</a></td>
        <td align="center" width="120"><a href="https://www.youtube.com/playables"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/youtube.png" width="48" height="48" alt="YouTube"><br>YouTube</a></td>
        <td align="center" width="120"><a href="https://crazygames.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/crazygames.png" width="48" height="48" alt="CrazyGames"><br>CrazyGames</a></td>
        <td align="center" width="120"><a href="https://poki.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/poki.png" width="48" height="48" alt="Poki"><br>Poki</a></td>
        <td align="center" width="120"><a href="https://gamedistribution.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/gamedistribution.png" width="48" height="48" alt="GameDistribution"><br>GameDistribution</a></td>
        <td align="center" width="120"><a href="https://yandex.com/games"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/yandex.png" width="48" height="48" alt="Yandex Games"><br>Yandex Games</a></td>
    </tr>
    <tr>
        <td align="center" width="120"><a href="https://www.facebook.com/games/instantgames"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/facebook.png" width="48" height="48" alt="Facebook"><br>Facebook</a></td>
        <td align="center" width="120"><a href="https://discord.com/gaming"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/discord.png" width="48" height="48" alt="Discord"><br>Discord</a></td>
        <td align="center" width="120"><a href="https://core.telegram.org/bots/webapps"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/telegram.png" width="48" height="48" alt="Telegram"><br>Telegram</a></td>
        <td align="center" width="120"><a href="https://www.reddit.com/r/GamesOnReddit/"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/reddit.png" width="48" height="48" alt="Reddit"><br>Reddit</a></td>
        <td align="center" width="120"><a href="https://developers.tiktok.com/doc/mini-games-sdk-overview"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/tiktok.png" width="48" height="48" alt="TikTok"><br>TikTok</a></td>
        <td align="center" width="120"><a href="https://apps.microsoft.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/microsoft-store.png" width="48" height="48" alt="Microsoft Store"><br>Microsoft Store</a></td>
    </tr>
    <tr>
        <td align="center" width="120"><a href="https://www.msn.com/en-us/play"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/msn.png" width="48" height="48" alt="MSN"><br>MSN</a></td>
        <td align="center" width="120"><a href="https://gamesnacks.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/gamesnacks.png" width="48" height="48" alt="GameSnacks"><br>GameSnacks</a></td>
        <td align="center" width="120"><a href="https://developer.samsung.com/instant-plays"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/samsung.png" width="48" height="48" alt="Samsung"><br>Samsung</a></td>
        <td align="center" width="120"><a href="https://appgallery.huawei.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/huawei.png" width="48" height="48" alt="Huawei"><br>Huawei</a></td>
        <td align="center" width="120"><a href="https://global.app.mi.com/details?lo=ES&la=en&id=com.xiaomi.glgm"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/xiaomi.png" width="48" height="48" alt="Xiaomi"><br>Xiaomi</a></td>
        <td align="center" width="120"><a href="https://play.jiogames.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/jiogames.png" width="48" height="48" alt="JioGames"><br>JioGames</a></td>
    </tr>
    <tr>
        <td align="center" width="120"><a href="https://vk.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/vk.png" width="48" height="48" alt="VK"><br>VK</a></td>
        <td align="center" width="120"><a href="https://ok.ru"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/ok.png" width="48" height="48" alt="OK"><br>OK</a></td>
        <td align="center" width="120"><a href="https://y8.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/y8.png" width="48" height="48" alt="Y8"><br>Y8</a></td>
        <td align="center" width="120"><a href="https://lagged.com"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/lagged.png" width="48" height="48" alt="Lagged"><br>Lagged</a></td>
        <td align="center" width="120"><a href="https://aha.game"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/dlightek.png" width="48" height="48" alt="Dlightek"><br>Dlightek</a></td>
        <td align="center" width="120"><a href="https://portalapp.games"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/platforms/portal.png" width="48" height="48" alt="Portal"><br>Portal</a></td>
    </tr>
</table>

More platforms are in progress. You choose where to publish when you [submit the game](https://developer.playgama.com/?utm_source=github&utm_medium=bridge).

## Game engines

<table>
    <tr>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-unity"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/unity.png" width="64" height="64" alt="Unity"><br>Unity</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-godot-4"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/godot.png" width="64" height="64" alt="Godot 4"><br>Godot 4</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-godot"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/godot.png" width="64" height="64" alt="Godot 3"><br>Godot 3</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-construct"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/construct.png" width="64" height="64" alt="Construct 3"><br>Construct 3</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-gamemaker"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/gamemaker.png" width="64" height="64" alt="GameMaker"><br>GameMaker</a></td>
    </tr>
    <tr>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-defold"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/defold.png" width="64" height="64" alt="Defold"><br>Defold</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-gdevelop"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/gdevelop.png" width="64" height="64" alt="GDevelop"><br>GDevelop</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-cocos-creator"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/cocos-creator.png" width="64" height="64" alt="Cocos Creator"><br>Cocos Creator</a></td>
        <td align="center" width="120"><a href="https://github.com/Playgama/bridge-scratch"><img src="https://raw.githubusercontent.com/Playgama/.github/main/assets/engines/scratch.png" width="64" height="64" alt="Scratch"><br>Scratch</a></td>
    </tr>
</table>

## Links

- [Documentation](https://wiki.playgama.com/playgama/bridge-sdk/getting-started?utm_source=github&utm_medium=bridge)
- [Config editor](https://playgama.github.io/bridge-config-editor/)
- [Bridge DevTools for Chrome](https://chromewebstore.google.com/detail/playgama-bridge-devtools/mldhijegcmagkcchjmenafiipkhjlppo)
- [Playgama MCP server](https://wiki.playgama.com/playgama/mcp?utm_source=github&utm_medium=bridge)
- [Discord community](https://discord.gg/pzqd2upxr8)
- [Publish a game on Playgama](https://developer.playgama.com/?utm_source=github&utm_medium=bridge)

## License

Released under the [GNU Lesser General Public License v3.0](LICENSE).
