# User Parameters

You can also retrieve various information about the player and their device.

#### Device Type

Determine the type of device (mobile, tablet, desktop, tv) the game is being played on to adjust the game's interface and performance settings.

```javascript
bridge.device.type
```

Returns the type of device the user launched the game from. Possible values: `mobile`, `tablet`, `desktop`, `tv`.

#### Authorization Support

Check if the platform supports player authorization to enable features that require user authentication, such as saving game progress or accessing social features.

```javascript
bridge.player.isAuthorizationSupported
```

#### Is the Player Currently Authorized

Verify if the player is currently authorized on the platform. This allows you to enable personalized features, such as saving high scores or providing user-specific content.

```javascript
bridge.player.isAuthorized
```

> **Info**
> If the player is not authorized, you can still check the player's ID and name, there may be a guest account in use.

#### Player ID

Get the player's unique ID on the platform to manage user-specific data and settings. Use this ID to track player progress, achievements, and purchases

```javascript
bridge.player.id
```

If the platform supports authorization and the player is currently authorized, this returns their platform ID. Otherwise, it returns `null`.

#### Player Name

Retrieve the player's name to personalize the game experience. Display the name in leaderboards, friend lists, or when sending notifications and messages.

```javascript
bridge.player.name
```

If there is no data – `null`. If the data is available, the data is in `string` format.

#### Player Avatar

Get the count of player avatars available. Use this to manage and display user profile images effectively, such as showing the avatar in multiplayer lobbies or profile screens.

```javascript
bridge.player.photos
```

Possible values: an array of player avatars (sorted by increasing resolution), empty array.

#### Player Extra Fields

Get platform-specific information (properties may vary depending on the platform).

```javascript
bridge.player.extra
```

Use this data to verify authorization. Currently, the Playgama API verification only supports `playgama`, `msn` and `microsoft_store` platforms.

```bash
curl -X POST "https://playgama.com/api/bridge/v1/verify" \
  -H "Content-Type: application/json" \
  -d '{"platform":"<PLATFORM_ID>","type":"authorization","data":{  <...bridge.player.extra> }}'
  
#  Response:
#  {
#    success: boolean;
#    errorMessage?: string;

#    -- authorization --
#    playerId?: string;
#    publisherPlayerId?: string;
#  }
```

#### Player Authorization

Authorize the player on the platform to access protected features and personalize the game experience. For example, prompting the player to log in to save their progress or unlock social sharing features.

```javascript
// optional parameter
let options = { }

bridge.player.authorize(options)
    .then(() => {
        // player successfully authorized
    })
    .catch(error => {
        // error, something went wrong
    })
```
