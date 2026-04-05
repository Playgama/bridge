# Platform Parameters

At any time, you can retrieve values for specific parameters that you might use in your game, such as the user's browser language.

#### Platform ID

Identify the platform on which the game is currently running to customize features and settings accordingly.

```javascript
bridge.platform.id
```

Returns the ID of the platform on which the game is currently running. Possible values: `playgama`, `vk`, `ok`, `yandex`, `facebook`, `crazy_games`, `game_distribution`, `playdeck`, `telegram`, `y8`, `lagged`, `msn`, `microsoft_store`, `poki`, `qa_tool`, `discord`, `gamepush`, `bitquest`, `huawei`, `jio_games`, `reddit`, `youtube`, `mock`, `xiaomi`.

#### Native SDK

Returns the native SDK of the platform.

```javascript
bridge.platform.sdk
```

#### Language

> **Warning**
> Check the language to display proper text labels.

Get the language set by the user on the platform or the browser language if not provided by the platform, to localize game content.

```javascript
bridge.platform.language
```

If the platform provides user language data, this will be the language set by the user on the platform. If not, it will be the browser language.

Format: ISO 639-1. Example: `ru`, `en`.

#### URL Parameter

Embed auxiliary information into the game URL to pass additional data or settings when launching the game.

```javascript
bridge.platform.payload
```

This parameter allows embedding auxiliary information into the game URL.

| Platform | URL Format |
| --- | --- |
| VK | http://vk.com/game_id**#your-info** |
| Yandex | http://yandex.com/games/app/game_id**?payload=your-info** |
| Crazy Games | crazygames.com/game/game_name**?payload=your-info** |
| Mock | site.com/game_name**?payload=your-info** |

#### Domain Information

Retrieve the top-level domain of the platform to handle domain-specific configurations and behavior.

```javascript
bridge.platform.tld
```

Returns the top-level domain (TLD) of the platform. If there is no data – `null`. If the data is available – `com`, `ru`, etc.

#### Is Get All Games Supported

Verify whether the platform supports the `getAllGames` method to retrieve the correct links to the developer's other games.

```javascript
bridge.platform.isGetAllGamesSupported
```

#### Is Get Game By Id Supported

Verify whether the platform supports the `getGameById` method to retrieve the correct link to a specific game.

```javascript
bridge.platform.isGetGameByIdSupported
```

#### Get All Games

This method retrieves the correct links to the developer's other games.

```javascript
bridge.platform.getAllGames()
    .then(data => {
        if (bridge.platform.id === "yandex") {
            for (const game of data) {
                console.log("AppID:", game["appID"])
                console.log("Title:", game["title"])
                console.log("URL:", game["url"])
                console.log("CoverURL:", game["coverURL"])
                console.log("IconURL:", game["iconURL"])
            }
        }
    })
```

#### Get Game By Id

This method retrieves the correct link to a specific game from the developer.

```javascript
const options = {}

if (bridge.platform.id === "yandex") {
    options = {
        gameId: "111111"
    }
}

bridge.platform.getGameById(options)
    .then(game => {
        if (bridge.platform.id === "yandex") {
            console.log("AppID:", game["appID"])
            console.log("Title:", game["title"])
            console.log("URL:", game["url"])
            console.log("CoverURL:", game["coverURL"])
            console.log("IconURL:", game["iconURL"])
            console.log("IsAvailable:", game["isAvailable"])
        }
    })
```

#### Sending a Message to the Platform

> **Warning**
> The call to `sendMessage` with the parameter `game_ready` is mandatory!
>
> Don't forget to implement it. Send this message only when the game is fully loaded.

Send predefined messages to the platform to trigger specific actions or events, such as signaling that the game is ready.

```javascript
bridge.platform.sendMessage("game_ready")
```

| Message | Parameters | Description |
| --- | --- | --- |
| game_ready | No parameters | The game has loaded, all loading screens have passed, the player can interact with the game. |
| in_game_loading_started | No parameters | Any loading within the game has started. For example, when a level is loading. |
| in_game_loading_stopped | No parameters | In-game loading has finished. |
| player_got_achievement | No parameters | The player reached a significant moment. For example, defeating a boss, setting a record, etc. |
| level_started | optional "world" and "level" example: {"world":"desert","level":"1"} | Gameplay has started. For example, the player has entered a level from the main menu. |
| level_completed | optional "world" and "level" example: {"world":"desert","level":"1"} | Gameplay has completed. For example, the player won level. |
| level_failed | optional "world" and "level" example: {"world":"desert","level":"1"} | Gameplay has failed. For example, the player lost level. |
| level_pause | optional "world" and "level" example: {"world":"desert","level":"1"} | Gameplay has paused. Opened settings menu or used pause button |
| level_resumed | optional "world" and "level" example: {"world":"desert","level":"1"} | Gameplay has resumed. Returned from settings menu or hit unpause button |

#### Is Audio Enabled

Check if the audio is turned on on the platform.

```javascript
bridge.platform.isAudioEnabled
```

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, isEnabled => {
    console.log('Is audio enabled:', isEnabled);
});
```

#### Pause

```javascript
// Listen for state changes
bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, isPaused => {
    console.log('Is paused:', isPaused);
});
```

#### Server Time

```javascript
bridge.platform.getServerTime()
    .then(result => {
        console.log(result) // UTC time in milliseconds
    })
    .catch(error => {
        console.log(error)
    })
```

#### Current Visibility State

Check if the game tab is visible or hidden, and adjust game behavior accordingly, such as muting sound when hidden.

```javascript
bridge.game.visibilityState
```

```javascript
// Listen for visibility state changes
bridge.game.on(bridge.EVENT_NAME.VISIBILITY_STATE_CHANGED, state => {
    console.log('Visibility state:', state);
});
```

Returns the current visibility state of the game (the tab with the game). Possible values: `visible`, `hidden`.

> **Info**
> React to visibility state changes. For example, mute the game sound when `hidden` and unmute when `visible`.
