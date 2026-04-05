# Interstitial

> **Info**
> There are some advertisement settings in the `playgama-bridge-config.json` file
>
> [playgama-bridge-config](playgama-bridge-config.md)

Interstitial ads typically appear during transitions in the game, such as level loading or after game over.

#### Is Interstitial Supported

Check if the platform supports displaying interstitial ads.

```javascript
bridge.advertisement.isInterstitialSupported
```

#### Minimum Interval Between Displays

Set the minimum time interval between interstitial ad displays to comply with platform requirements and improve user experience.

```javascript
// Default value = 60 seconds
bridge.advertisement.minimumDelayBetweenInterstitial

bridge.advertisement.setMinimumDelayBetweenInterstitial(30)
```

There should be time intervals between interstitial ad displays. For convenience, this SDK includes a built-in timer mechanism between ad displays. You just need to specify the required interval, and you can call the ad display method as often as you like.

#### Interstitial State

> **Warning**
> Check the `interstitialState` at the start of the game, and if the ad is `opened`, perform the necessary actions (mute sounds/pause the game/etc.).

Track the state of the interstitial ad to manage ad display and user experience.

```javascript
bridge.advertisement.interstitialState
```

Possible values: `loading`, `opened`, `closed`, `failed`.

```javascript
// To track interstitial ad state changes, subscribe to the event
bridge.advertisement.on(
    bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, 
    state => console.log('Interstitial state: ', state)
)
```

> **Info**
> React to changes in ad state. For example, mute the game sound when `opened` and unmute when `closed` and `failed`.

#### Show Interstitial

Display an interstitial ad at appropriate moments, such as during level transitions or game over screens.

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showInterstitial(placement)
```

> **Warning**
> Do not call `showInterstitial()` method at the start of the game. On platforms where this is allowed, the ad will be shown automatically.
