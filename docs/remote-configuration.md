# Remote Configuration

Manage your game settings remotely without releasing updates, allowing for dynamic adjustments and feature toggling.

#### Support

Check if remote configuration is supported to manage game settings without releasing updates.

```javascript
bridge.remoteConfig.isSupported
```

#### Load Values

Load configuration settings from the server to dynamically adjust game parameters based on real-time data.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'yandex':
        options = {
            clientFeatures: [ // optional parameter
                { name: 'levels', value: '5' }
            ]
        }
        break
}

bridge.remoteConfig.get(options)
    .then(data => {
        // your custom data, example: { showFullscreenAdOnStart: 'no', difficult: 'hard' }
        console.log(data)
    })
    .catch(error => {
        // error
    })
```
