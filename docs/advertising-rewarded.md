# Rewarded

> **Info**
> There are some advertisement settings in the `playgama-bridge-config.json` file
>
> [playgama-bridge-config](playgama-bridge-config.md)

**Rewarded ads** are a type of advertisement where players have the option to watch an ad in exchange for in-game rewards

Offer players rewards in exchange for watching ads, incentivizing ad engagement and increasing ad revenue.

#### Is Rewarded Supported

Check if the platform supports displaying rewarded ads.

```javascript
bridge.advertisement.isRewardedSupported
```

#### Rewarded State

Monitor the state of the rewarded ad (loading, opened, closed, rewarded, failed) to manage the reward process.

```javascript
bridge.advertisement.rewardedState
```

Possible values: `loading`, `opened`, `closed`, `rewarded`, `failed`.

```javascript
// To track rewarded ad state changes, subscribe to the event
bridge.advertisement.on(
    bridge.EVENT_NAME.REWARDED_STATE_CHANGED, 
    state => console.log('Rewarded state: ', state)
)
```

> **Info**
> React to changes in ad state. For example, mute the game sound when `opened` and unmute when `closed` and `failed`.

> **Danger**
> Reward the player only when the state is `rewarded`.

#### Rewarded Placement

Monitor the current placement of the rewarded ad to manage the reward process.

```javascript
bridge.advertisement.rewardedPlacement
```

#### Show Rewarded Ad

Display a rewarded ad and provide incentives to players for watching the entire ad.

```javascript
let placement = 'test_placement' // optional
bridge.advertisement.showRewarded(placement)
```
