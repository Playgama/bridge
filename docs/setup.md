# Setup

JS Core is the heart of the SDK, containing all the core logic. Plugins for game engines (Unity, Godot, Construct) are merely overlays on top of JS Core. JS Core can be used directly without any plugins in web engines (PlayCanvas, Phaser, LayaAir, etc.).

### Integration

Add the script from CDN:

```html
<html>
    <head>
        <script src="https://bridge.playgama.com/v1/stable/playgama-bridge.js"></script>
    </head>
    <body>...</body>
</html>
```

When the game is launched on supported platforms, the SDK will automatically load the necessary platform scripts. On unsupported platforms, no errors will occur; a mock platform will be used, and any request will return `false`, `reject`, etc.

#### Available routes

| URL | Description |
| --- | --- |
| `https://bridge.playgama.com/v1/stable/playgama-bridge.js` (recommended) | Contains the latest version for major v1.x.x. There will be no backward-incompatible changes. |
| `https://bridge.playgama.com/latest/playgama-bridge.js` | Contains the latest version of the SDK. There may be backward-incompatible changes. |
| `https://bridge.playgama.com/v1.25.0/playgama-bridge.js` `https://bridge.playgama.com/v1.26.0/playgama-bridge.js` etc. | Contains the SDK of a specific version. |

### Config

Download the `playgama-bridge-config.json` file from the [GitHub release page](https://github.com/playgama/bridge/releases), and add it to your project. There you can set up various identifiers and in-game purchases.

You can see an explanation of the file structure here: [playgama-bridge-config](playgama-bridge-config.md).

### Initialization

Before using the SDK, you need to call the initialization method and wait for it to complete.

```javascript
bridge.initialize()
    .then(() => {
        // initialization was successful, SDK can be used
    })
    .catch(error => {
        // error, something went wrong
    })
```
