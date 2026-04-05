# Banner

> **Info**
> There are some advertisement settings in the `playgama-bridge-config.json` file
>
> [playgama-bridge-config](playgama-bridge-config.md)

#### Is Banner Supported

Check if the platform supports displaying banner ads. Use this to determine if you can include banner advertisements in your game

```javascript
bridge.advertisement.isBannerSupported
```

> **Info**
> Ensure that in-game banners are not displayed during gameplay on CrazyGames. Please refer to [Advertisement - CrazyGames Documentation](https://docs.crazygames.com/requirements/ads/).

#### Show Banner

Display a banner ad within your game to generate revenue through advertising.

```javascript
let position = 'bottom' // optional, 'top' | 'bottom', default = bottom
let placement = 'test_placement' // optional
bridge.advertisement.showBanner(position, placement)
```

#### Hide Banner

Hide the currently displayed banner ad when it is no longer needed.

```javascript
bridge.advertisement.hideBanner()
```

#### Banner State

Monitor the state of the banner ad (loading, shown, hidden, failed) to manage its display and troubleshoot issues.

```javascript
bridge.advertisement.bannerState
```

```javascript
// Listen for banner state changes
bridge.advertisement.on(bridge.EVENT_NAME.BANNER_STATE_CHANGED, state => {
    console.log('Banner state: ', state)
})
```

Possible values: `loading`, `shown`, `hidden`, `failed`.
