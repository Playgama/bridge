# Playgama Bridge Configuration Reference

This document describes all available configuration parameters for `playgama-bridge-config.json`.

## Table of Contents

- [Root-Level Parameters](#root-level-parameters)
- [Advertisement Configuration](#advertisement-configuration)
- [Game Configuration](#game-configuration)
- [Device Configuration](#device-configuration)
- [Leaderboards Configuration](#leaderboards-configuration)
- [Payments Configuration](#payments-configuration)
- [SaaS Configuration](#saas-configuration)
- [Platform-Specific Configuration](#platform-specific-configuration)
- [Complete Example](#complete-example)

---

## Root-Level Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `$schema` | string | - | JSON schema URL for config validation |
| `forciblySetPlatformId` | string | `undefined` | Forces a specific platform ID regardless of URL detection (e.g., `playgama`, `msn`, `crazy_games`) |
| `sendAnalyticsEvents` | boolean | `true` | Enable/disable sending analytics events to Playgama servers |
| `disableLoadingLogo` | boolean | `false` | Hide the loading progress logo during initialization |
| `showFullLoadingLogo` | boolean | `false` | Show full Playgama Bridge branding in loading screen (hardcode `false` for Yandex) |

---

## Advertisement Configuration

The `advertisement` object controls ad behavior across all platforms.

### General Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `advertisement.useBuiltInErrorPopup` | boolean | `false` | Show built-in error popup when ad fails to load |
| `advertisement.backfillId` | string | `""` | Backfill ad provider ID (used by MSN platform) |

### Interstitial Ads

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `advertisement.interstitial.disable` | boolean | `false` | Disable interstitial ads even if platform supports them |
| `advertisement.interstitial.preloadOnStart` | boolean/string | `false` | Preload interstitial on SDK initialization. Set to `true` or placement ID |
| `advertisement.interstitial.placementFallback` | string | `undefined` | Fallback placement if none specified in method call |
| `advertisement.interstitial.minimumDelayBetweenInterstitial` | number | `60` | Minimum seconds between interstitial ads |
| `advertisement.interstitial.placements` | array | `[]` | Array of placement configuration objects |

### Rewarded Ads

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `advertisement.rewarded.disable` | boolean | `false` | Disable rewarded ads even if platform supports them |
| `advertisement.rewarded.preloadOnStart` | boolean/string | `false` | Preload rewarded ad on SDK initialization. Set to `true` or placement ID |
| `advertisement.rewarded.placementFallback` | string | `undefined` | Fallback placement if none specified in method call |
| `advertisement.rewarded.placements` | array | `[]` | Array of placement configuration objects |

### Banner Ads

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `advertisement.banner.disable` | boolean | `false` | Disable banner ads even if platform supports them |
| `advertisement.banner.placementFallback` | string | `undefined` | Fallback placement if none specified in method call |
| `advertisement.banner.placements` | array | `[]` | Array of placement configuration objects |

### Placement Configuration

Each placement object in the `placements` array has the following structure:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Unified placement ID used in your game code |
| `{platformId}` | string | Platform-specific placement ID (e.g., `playgama`, `msn`, `crazy_games`) |

**Example:**
```json
{
    "advertisement": {
        "interstitial": {
            "placements": [
                {
                    "id": "level_end",
                    "<PLATFROM_ID>": "<PLATFORM_PLACEMENT>",
                }
            ]
        }
    }
}
```

---

## Game Configuration

The `game` object controls game-related behavior.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `game.adaptToSafeArea` | boolean | `false` | Apply safe area styles for devices with notches/home indicators |

---

## Device Configuration

The `device` object controls device-related behavior.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `device.useBuiltInOrientationPopup` | boolean | `false` | Show orientation restriction overlay when device orientation doesn't match |
| `device.supportedOrientations` | array | `['portrait', 'landscape']` | Allowed device orientations |

---

## Leaderboards Configuration

The `leaderboards` array defines leaderboard mappings across platforms.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Unified leaderboard ID used in your game code |
| `isMain` | boolean | Mark this as the main/primary leaderboard |
| `{platformId}` | string | Platform-specific leaderboard ID |

**Example:**
```json
{
    "leaderboards": [
        {
            "id": "high_scores",
            "isMain": true,
            "<PLATFORM_ID>": "<PLATFORM_LEADERBOARD_ID>",
        }
    ]
}
```

---

## Payments Configuration

The `payments` array defines in-app purchase product mappings.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Unified product ID used in your game code |
| `{platformId}` | object | Platform-specific product data |
| `{platformId}.id` | string | Platform-specific product/SKU ID |
| `{platformId}.price` | number/string | Platform-specific price |

**Example:**
```json
{
    "payments": [
        {
            "id": "coins_100",
            "<PLATFORM_ID>": {
                "id": "<PLATFORM_PAYMENT_ID>",
                "<PLATFORM_SPECIFIC_PROPERTY>": "<PLATFORM_SPECIFIC_VALUE>"
            }
        }
    ]
}
```

---

## SaaS Configuration

The `saas` object configures Playgama SaaS services.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `saas.baseUrl` | string | `https://playgama.com/api/bridge/v1` | Base URL for SaaS API requests |
| `saas.publicToken` | string | `""` | Public token for SaaS API authentication |
| `saas.leaderboards.platforms` | array | `[]` | List of platform IDs to use SaaS leaderboards instead of native |

---

## Platform-Specific Configuration

### Per-Platform Overrides

Use the `platforms` object to provide platform-specific configuration overrides:

```json
{
    "platforms": {
        "<PLATFORM_ID>": {
            "<PLATFORM_SPECIFIC_PROPERTY>": "<PLATFORM_SPECIFIC_VALUE>",
            "advertisement": {
                "interstitial": {
                    "minimumDelayBetweenInterstitial": "<PLATFORM_OVERRIDEN_VALUE>"
                }
            }
        }
    }
}
```

### Platform-Specific Options

These parameters are specific to individual platforms and should be placed at root level or within `platforms.{platformId}`:

#### Yandex Games
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | Yandex Games application ID |
| `useSignedData` | boolean | Use signed data for secure storage requests |

#### VK Games
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | VK Mini Apps application ID |

#### CrazyGames
| Parameter | Type | Description |
|-----------|------|-------------|
| `xsollaProjectId` | string | Xsolla project ID for payments |
| `isSandbox` | boolean | Use Xsolla sandbox environment |
| `useUserToken` | boolean | Use user token instead of server token |

#### Discord
| Parameter | Type | Description |
|-----------|------|-------------|
| `appId` | string | Discord application ID |

#### Telegram
| Parameter | Type | Description |
|-----------|------|-------------|
| `adsgramBlockId` | string | Adsgram block ID for ads |

#### TikTok
| Parameter | Type | Description |
|-----------|------|-------------|
| `clientKey` | string | TikTok client key |

#### Facebook
| Parameter | Type | Description |
|-----------|------|-------------|
| `subscribeForNotificationsOnStart` | boolean | Auto-subscribe to notifications on init |

#### Y8
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | Y8 game ID |
| `channelId` | string | YouTube channel ID for ads |
| `adsenseId` | string | Google AdSense ID |

#### GameDistribution
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | GameDistribution game ID |

#### GamePush
| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | GamePush project ID |
| `publicToken` | string | GamePush public API token |

#### Lagged
| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | string | Lagged project ID |
| `devId` | string | Developer ID |
| `publisherId` | string | Publisher ID |

#### Xiaomi
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | Xiaomi game ID |
| `adSenseId` | string | Google AdSense ID for ads |
| `testMode` | boolean | Enable test mode for ads |

#### Huawei
| Parameter | Type | Description |
|-----------|------|-------------|
| `appId` | string | Huawei AppGallery app ID |

#### MSN
| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | string | MSN game ID |
| `playgamaAdsId` | string | Playgama Ads integration ID |

#### JioGames
| Parameter | Type | Description |
|-----------|------|-------------|
| `adTestMode` | boolean | Enable ad test mode |

---

## Configuration Loading

- **Default path**: `./playgama-bridge-config.json`
- **Custom path**: Pass `configFilePath` to initialization:
  ```javascript
  bridge.initialize({ configFilePath: '/path/to/config.json' })
  ```

## Key Notes

1. **Config Merging**: Platform-specific configs in `platforms.{platformId}` are deeply merged with root-level config
2. **Placement Mapping**: Placements use unified IDs that map to platform-specific identifiers
3. **Optional Properties**: Most config options are optional with sensible defaults