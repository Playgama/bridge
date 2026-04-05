# Leaderboards

#### Leaderboards Type

Type of leaderboards on the current platform.

```javascript
bridge.leaderboards.type
```

| Type | Game Logic |
| --- | --- |
| `not_available` | Leaderboards are not available. Any leaderboard functionality must be disabled in the game. |
| `in_game` | Leaderboards are available. The game must use the `setScore` method to set the player's score. The game should display custom in-game leaderboards using the data from the `getEntries` method. |
| `native` | Leaderboards are available. The game must use the `setScore` method to set the player's score. The game should not display custom in-game leaderboards because leaderboards are displayed in the platform interface and the `getEntries` method does not work. |
| `native_popup` | Leaderboards are available. The game must use the `setScore` method to set the player's score. The game should call `showNativePopup` to display leaderboards overlay and the `getEntries` method does not work. |

#### Setup

Setup leaderboards in the [config file](playgama-bridge-config.md). For each leaderboard add an `id`. You can override which id is sent to the platform's native SDK.

```json
{
    ...    
    "leaderboards": [
        {
            "id": "test_leaderboard", // use this id in game logic
            "<ANY_PLATFORM_ID_HERE>": "<OVERRIDED_ID_FOR_PLATFORM_HERE>"
        }
    ]
}
```

#### Set Score

Submit the player's score to the leaderboard to update their rank and position.

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file
let score = 42

bridge.leaderboards.setScore(leaderboardId, score)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Get Entries

> **Info**
> Works only when `bridge.leaderboards.type` = `in_game`

Retrieve entries from the leaderboard, including the player's rank and score, to display a custom leaderboard in the game.

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.getEntries(leaderboardId)
    .then(entries => {
        entries.forEach(entry => {
            console.log('ID: ' + entry.id)
            console.log('Name: ' + entry.name)
            console.log('Photo: ' + entry.photo)
            console.log('Score: ' + entry.score)
            console.log('Rank: ' + entry.rank)
        })
    })
    .catch(error => {
        // error
    })
```

#### Show Native Popup

> **Info**
> Works only when `bridge.leaderboards.type` = `native_popup`

Displays the leaderboard overlay, including the player's rank and score.

```javascript
let leaderboardId = "YOUR_LEADERBOARD_ID" // id that you specified in the config file

bridge.leaderboards.showNativePopup(leaderboardId)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```
