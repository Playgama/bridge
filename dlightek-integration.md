# Dlightek Platform Bridge — Integration Plan

## Overview

Dlightek (Transsion/Tecno) is an H5 game platform with ad-based monetization via Google AFG wrapped in their own SDK (`window.h5sdk`). It supports interstitial, rewarded, and banner ads plus Athena event tracking and game loading time reporting.

**No support for:** payments, leaderboards, player auth, social features.

### Dlightek SDK Reference
- SDK URL: `https://www.hippoobox.com/static/sdk/adsdk_1.9.5.js`
- Global object: `window.h5sdk`
- Docs: `https://dev.dlightek.com/docs?id=36` (SDK), `https://dev.dlightek.com/docs?id=12` (platform guide)

### Closest Existing Reference
**XiaomiPlatformBridge** (`src/platform-bridges/XiaomiPlatformBridge.js`) — both use Google AFG ads with the same `adBreak()` callback structure. Key difference: Xiaomi uses `addAdsByGoogle()` to load Google's script directly; Dlightek wraps Google's script in its own SDK, so we load the Dlightek SDK via `addJavaScript()` and call `window.h5sdk` methods instead.

---

## How the Bridge Architecture Works

Understanding the overall architecture is essential for a correct integration.

### Initialization Lifecycle

```
src/index.js
  → new PlaygamaBridge() → window.bridge
  → bridge.initialize(options)
      1. ConfigFileModule loads playgama-bridge-config.json
      2. Platform detected (hostname/URL param/config/global object)
      3. Platform bridge class dynamically imported via platformImports.js
      4. 14 feature modules created (Advertisement, Storage, Payments, etc.)
      5. platformBridge.initialize() called (loads SDK, resolves when ready)
      6. Ads optionally preloaded, loading progress set to 100%
```

### Core Design Patterns

**Bridge Pattern** — Every platform extends `PlatformBridgeBase` (~100 methods/getters). Platforms only override what they support; everything else returns `false` / `Promise.reject()` by default.

**Module Delegation** — Feature modules (AdvertisementModule, StorageModule, etc.) are the public API. They validate input, then call `platformBridge.methodName()`. Game code never calls platform bridges directly.

**Event System** (EventLite mixin) — Both bridges and modules emit events:
- `INTERSTITIAL_STATE_CHANGED`, `REWARDED_STATE_CHANGED`, `BANNER_STATE_CHANGED`
- `PAUSE_STATE_CHANGED`, `AUDIO_STATE_CHANGED`, `VISIBILITY_STATE_CHANGED`

**State Aggregation** — Multiple pause/audio sources (interstitial, rewarded, visibility, platform) are combined via `StateAggregator` with OR logic. If ANY source pauses, the game is paused. This is automatic when you call `_setInterstitialState(OPENED)`.

**PromiseDecorator** — Prevents duplicate async operations. Calling `initialize()` multiple times returns the same promise.

**Config Deep Merge** — Global config merges with `platforms.{platformId}` section via `deepMerge()`. Platform bridges access merged config via `this._options`.

### Build System & Code Splitting

The webpack build uses **`__INCLUDE_*__` flags** (defined via `webpack.DefinePlugin`) to enable tree-shaking of unused platforms:

```js
// webpack.config.js
createPlatformDefines(targetPlatforms) {
    for (const id of ALL_PLATFORM_IDS) {
        defines[`__INCLUDE_${id.toUpperCase()}__`] = includeAll || targetPlatforms.includes(id)
    }
}
```

The `ALL_PLATFORM_IDS` list is **auto-extracted** from `platformImports.js` by parsing `__INCLUDE_*__` patterns (`scripts/platforms.js`). So adding `__INCLUDE_DLIGHTEK__` to platformImports.js automatically registers it in the build system.

Build modes:
- `npm run build` — bundled (single file, all platforms)
- `npm run build:dynamic` — code splitting (separate chunk per platform)
- `--env platform=dlightek` — single-platform build (only Dlightek included)

### Feature Module List

| Module | Public API via `bridge.*` | Delegates to platform bridge |
|--------|--------------------------|------------------------------|
| PlatformModule | `bridge.platform.id`, `.sdk`, `.language`, `.sendMessage()` | `platformBridge.sendMessage()`, `.platformLanguage`, etc. |
| PlayerModule | `bridge.player.id`, `.name`, `.authorize()` | `platformBridge.authorizePlayer()` |
| GameModule | `bridge.game.visibilityState`, `.setLoadingProgress()` | Handles UI directly + forwards events |
| StorageModule | `bridge.storage.get()`, `.set()`, `.delete()` | `platformBridge.getDataFromStorage()`, etc. |
| AdvertisementModule | `bridge.advertisement.showInterstitial()`, `.showRewarded()`, `.showBanner()` | `platformBridge.showInterstitial()`, etc. |
| SocialModule | `bridge.social.share()`, `.inviteFriends()` | `platformBridge.share()`, etc. |
| DeviceModule | `bridge.device.type`, `.orientation` | Handles detection directly |
| LeaderboardsModule | `bridge.leaderboards.setScore()`, `.getEntries()` | `platformBridge.leaderboardsSetScore()`, etc. |
| PaymentsModule | `bridge.payments.purchase()`, `.getCatalog()` | `platformBridge.paymentsPurchase()`, etc. |
| RemoteConfigModule | `bridge.remoteConfig.get()` | `platformBridge.getRemoteConfig()` |
| ClipboardModule | `bridge.clipboard.read()`, `.write()` | `platformBridge.clipboardRead()`, etc. |
| AchievementsModule | `bridge.achievements.unlock()`, `.getList()` | `platformBridge.unlockAchievement()`, etc. |
| AnalyticsModule | Internal — auto-tracks events | Singleton, sends to Playgama API |

### Platform Detection Priority

In `PlaygamaBridge.js#createPlatformBridge()`:
1. `forciblySetPlatformId` in config (highest)
2. `?platform_id=xxx` URL parameter
3. Hostname patterns (`crazygames.`, `poki-gdn`, `discordsays.com`, etc.)
4. URL hash patterns (`tgWebAppData`, `yandex`)
5. Query param combos (VK: `api_id`+`viewer_id`+`auth_key`)
6. Global object detection (`window.TTMinis` → TikTok)
7. Falls back to `PLATFORM_ID.MOCK`

### Feature Support Across Platforms (for context)

| Feature | Platforms supporting | Dlightek |
|---------|---------------------|----------|
| Interstitial ads | 22/26 | Yes |
| Rewarded ads | 22/26 | Yes |
| Banner ads | 12/26 | Yes |
| Player auth | 15/26 | No |
| Platform storage | 16/26 | No |
| Payments | 10/26 | No |
| Leaderboards | 7/26 | No |
| Social features | 8/26 | No |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/constants.js` | Modify | Add `DLIGHTEK: 'dlightek'` to `PLATFORM_ID` enum |
| `src/platformImports.js` | Modify | Add `__INCLUDE_DLIGHTEK__` guarded import |
| `src/platform-bridges/DlightekPlatformBridge.js` | **Create** | New platform bridge class |
| `src/PlaygamaBridge.js` | No change | Auto-detection deferred; config/URL param already work |

---

## Step 1: Add Platform ID

**File:** `src/constants.js`

Add after `TIKTOK: 'tiktok'`:

```js
DLIGHTEK: 'dlightek',
```

---

## Step 2: Add Dynamic Import

**File:** `src/platformImports.js`

Add after the TikTok block (before `export async function fetchPlatformBridge`):

```js
if (__INCLUDE_DLIGHTEK__) {
    platformImports[PLATFORM_ID.DLIGHTEK] = () => import('./platform-bridges/DlightekPlatformBridge')
}
```

The `__INCLUDE_DLIGHTEK__` flag is **automatically registered** by the build system — `scripts/platforms.js` parses `platformImports.js` for `__INCLUDE_*__` patterns and adds them to `ALL_PLATFORM_IDS`. Webpack's `DefinePlugin` then sets the flag to `true` (all platforms) or `false` (platform-specific build).

---

## Step 3: Create DlightekPlatformBridge

**File (new):** `src/platform-bridges/DlightekPlatformBridge.js`

### 3.1 Imports

```js
import PlatformBridgeBase from './PlatformBridgeBase'
import {
    PLATFORM_ID,
    ACTION_NAME,
    ERROR,
    BANNER_STATE,
    BANNER_CONTAINER_ID,
    INTERSTITIAL_STATE,
    REWARDED_STATE,
    PLATFORM_MESSAGE,
} from '../constants'
import { addJavaScript, createAdvertisementBannerContainer } from '../common/utils'
```

**Note:** We do NOT import `addAdsByGoogle` — the Dlightek SDK handles Google script loading internally. We use `addJavaScript` (from `src/common/utils.js`) to load the Dlightek SDK script dynamically.

### 3.2 Feature Getters

```js
class DlightekPlatformBridge extends PlatformBridgeBase {
    get platformId() {
        return PLATFORM_ID.DLIGHTEK
    }

    get isBannerSupported() {
        return true
    }

    get isInterstitialSupported() {
        return true
    }

    get isRewardedSupported() {
        return true
    }
```

Everything else (payments, leaderboards, player auth, social, etc.) inherits `false`/unsupported defaults from `PlatformBridgeBase`. No need to override.

### 3.3 Private Fields

```js
    #defaultSdkUrl = 'https://www.hippoobox.com/static/sdk/adsdk_1.9.5.js'
```

### 3.4 Initialization

The Dlightek SDK init flow:
1. Load SDK script via `addJavaScript()` → `window.h5sdk` becomes available
2. Call `h5sdk.init(appKey, '', '', '', '', options)` — the `options.adsense.callback` fires after Google ads are configured internally
3. Inside `callback`, call `h5sdk.adConfig()` — the `onReady` fires when ads can be shown
4. Resolve bridge initialization in `onReady`

```js
    initialize() {
        if (this._isInitialized) {
            return Promise.resolve()
        }

        let promiseDecorator = this._getPromiseDecorator(ACTION_NAME.INITIALIZE)
        if (!promiseDecorator) {
            promiseDecorator = this._createPromiseDecorator(ACTION_NAME.INITIALIZE)

            if (!this._options?.appKey || !this._options?.adSenseId) {
                this._rejectPromiseDecorator(
                    ACTION_NAME.INITIALIZE,
                    ERROR.GAME_PARAMS_NOT_FOUND,
                )
            } else {
                const sdkUrl = this._options.sdkUrl || this.#defaultSdkUrl

                addJavaScript(sdkUrl)
                    .then(() => {
                        if (!window.h5sdk) {
                            throw new Error('Dlightek SDK not found')
                        }

                        this._platformSdk = window.h5sdk

                        const adsenseOptions = {
                            client: this._options.adSenseId,
                            'data-ad-frequency-hint': this._options.adFrequencyHint || '45s',
                            callback: () => {
                                this._platformSdk.adConfig({
                                    preloadAdBreaks: 'on',
                                    sound: 'on',
                                    onReady: () => {
                                        this._playerApplyGuestData()
                                        this._isInitialized = true
                                        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
                                    },
                                })
                            },
                        }

                        if (this._options.adChannel) {
                            adsenseOptions['data-ad-channel'] = this._options.adChannel
                        }

                        if (this._options.testMode) {
                            adsenseOptions['data-adbreak-test'] = 'on'
                        }

                        this._platformSdk.init(
                            this._options.appKey,
                            '',
                            '',
                            '',
                            '',
                            { adsense: adsenseOptions },
                        )
                    })
                    .catch((error) => {
                        this._rejectPromiseDecorator(ACTION_NAME.INITIALIZE, error)
                    })
            }
        }

        return promiseDecorator.promise
    }
```

**Key design notes:**
- The adsense options use Dlightek's exact property names from their docs: `client`, `data-ad-frequency-hint`, `data-adbreak-test`, `data-ad-channel`
- Init resolves only when Google's `onReady` fires (ads are preloaded and ready)
- `_playerApplyGuestData()` sets default guest player info (no player auth on Dlightek)
- `PromiseDecorator` pattern ensures calling `initialize()` multiple times returns the same promise
- `this._platformSdk = window.h5sdk` makes the SDK accessible via `bridge.platform.sdk`

### 3.5 Platform Messages

```js
    sendMessage(message) {
        switch (message) {
            case PLATFORM_MESSAGE.GAME_READY: {
                return new Promise((resolve) => {
                    try {
                        if (this._platformSdk && this._platformSdk.gameLoadingCompleted) {
                            this._platformSdk.gameLoadingCompleted()
                        }
                    } catch (e) {
                        console.error(e)
                    }
                    resolve()
                })
            }
            default: {
                return super.sendMessage(message)
            }
        }
    }
```

Follows the same pattern as Xiaomi's `funmax.loadReady()`. When the game calls `bridge.platform.sendMessage('game_ready')`, this reports loading time to Dlightek for analytics. The Dlightek docs state this is **mandatory** — "Add this method to the node displayed on the game homepage".

### 3.6 Interstitial Ads

```js
    showInterstitial(placement) {
        if (!this._platformSdk) {
            this._showAdFailurePopup(false)
            return
        }

        this._platformSdk.adBreak({
            type: 'start',
            name: placement,
            beforeAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.OPENED)
            },
            afterAd: () => {
                this._setInterstitialState(INTERSTITIAL_STATE.CLOSED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus !== 'viewed') {
                    this._showAdFailurePopup(false)
                }
            },
        })
    }
```

**How state transitions work automatically:**
1. `beforeAd` fires → `_setInterstitialState(OPENED)` → `StateAggregator` sets `interstitial` pause source → `PAUSE_STATE_CHANGED` event fires → game pauses + audio mutes
2. `afterAd` fires → `_setInterstitialState(CLOSED)` → `StateAggregator` clears `interstitial` source → game resumes (if no other pause sources active)
3. `adBreakDone` fires → if `breakStatus !== 'viewed'`, `_showAdFailurePopup()` shows fallback UI

The `AdvertisementModule` wrapping this also enforces:
- Minimum delay between interstitials (configurable, default 60s)
- Prevents overlapping ads (`hasAdvertisementInProgress` check)
- Placement mapping from config

### 3.7 Rewarded Ads

```js
    showRewarded(placement) {
        if (!this._platformSdk) {
            this._showAdFailurePopup(true)
            return
        }

        this._platformSdk.adBreak({
            type: 'reward',
            name: placement,
            beforeAd: () => {
                this._setRewardedState(REWARDED_STATE.OPENED)
            },
            afterAd: () => {
                this._setRewardedState(REWARDED_STATE.CLOSED)
            },
            beforeReward: (showAdFn) => { showAdFn(0) },
            adDismissed: () => {},
            adViewed: () => {
                this._setRewardedState(REWARDED_STATE.REWARDED)
            },
            adBreakDone: (placementInfo) => {
                if (placementInfo.breakStatus === 'frequencyCapped'
                    || placementInfo.breakStatus === 'other') {
                    this._showAdFailurePopup(true)
                }
            },
        })
    }
```

State transitions:
- `beforeAd` → OPENED (game pauses + audio mutes via StateAggregator)
- `adViewed` → REWARDED (user completed watching — game should grant reward)
- `afterAd` → CLOSED (game resumes)
- `adDismissed` → no reward (user skipped early)
- `beforeReward` → calls `showAdFn(0)` to proceed with reward video
- `adBreakDone` with `frequencyCapped`/`other` → failure popup

### 3.8 Banner Ads

```js
    showBanner(position, placement) {
        if (this._bannerContainer) {
            return
        }

        this._bannerPlacement = placement
        this._bannerContainer = createAdvertisementBannerContainer(position)

        const ins = this.#createIns(placement)
        this._bannerContainer.appendChild(ins)

        this._setBannerState(BANNER_STATE.SHOWN)
    }

    hideBanner() {
        this._bannerContainer?.remove()
        this._bannerContainer = null

        this._setBannerState(BANNER_STATE.HIDDEN)
    }

    #createIns(placementId) {
        const ins = document.createElement('ins')
        ins.style.display = 'block'
        ins.classList.add('adsbygoogle')
        ins.setAttribute('data-ad-client', this._options.adSenseId)
        ins.setAttribute('data-ad-slot', placementId)
        ins.setAttribute('data-ad-format', 'auto')
        ins.setAttribute('data-container-id', BANNER_CONTAINER_ID)
        ins.setAttribute('data-full-width-responsive', 'true')

        if (this._options.testMode) {
            ins.setAttribute('data-adtest', 'on')
        }

        return ins
    }
}

export default DlightekPlatformBridge
```

Banner uses standard Google AdSense `<ins>` elements — identical pattern to XiaomiPlatformBridge. `window.adsbygoogle` is available after Dlightek SDK init since it loads Google's script internally. The `createAdvertisementBannerContainer()` utility (from `src/common/utils.js`) creates a fixed-position div at TOP or BOTTOM of the viewport.

---

## Step 4: Platform Detection (deferred)

No auto-detection for now. Games use either:
- **Config:** `"forciblySetPlatformId": "dlightek"` in `playgama-bridge-config.json`
- **URL param:** `?platform_id=dlightek`

Both paths already work via existing code in `PlaygamaBridge.js` (lines 266-271) once the `DLIGHTEK` enum value exists. The `#getPlatformId()` method validates against `Object.values(PLATFORM_ID)`.

When ready to add auto-detection later, add to `PlaygamaBridge.js#createPlatformBridge()`:
```js
} else if (url.hostname.includes('ahagamecenter.com')) {
    platformId = PLATFORM_ID.DLIGHTEK
}
```

---

## Configuration

In `playgama-bridge-config.json`:

```json
{
    "forciblySetPlatformId": "dlightek",
    "platforms": {
        "dlightek": {
            "appKey": 1234567,
            "adSenseId": "ca-pub-1234567890",
            "adChannel": "987654321",
            "adFrequencyHint": "45s",
            "testMode": false,
            "sdkUrl": "https://www.hippoobox.com/static/sdk/adsdk_1.9.5.js"
        }
    }
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `appKey` | number | Yes | — | Unique game identifier from Dlightek upload form |
| `adSenseId` | string | Yes | — | Google AdSense client ID (e.g., `ca-pub-1234567890`) |
| `adChannel` | string | No | — | Ad channel ID for targeting/reporting |
| `adFrequencyHint` | string | No | `'45s'` | Minimum interval between ads (Dlightek minimum: 45s) |
| `testMode` | boolean | No | `false` | Enables test ads (`data-adbreak-test: on`) |
| `sdkUrl` | string | No | `adsdk_1.9.5.js` | Override SDK URL for different versions |

**How config flows to the bridge:**
1. `ConfigFileModule` fetches and parses the JSON
2. `getPlatformOptions('dlightek')` deep-merges root options with `platforms.dlightek`
3. Result stored in `platformBridge._options`
4. Bridge accesses values like `this._options.appKey`, `this._options.adSenseId`

---

## Dlightek SDK API Summary

| Method | Purpose | Bridge Usage |
|--------|---------|-------------|
| `h5sdk.init(appKey, t, l, b, r, opts)` | Initialize SDK + Google ads | Called in `initialize()` |
| `h5sdk.adConfig(config)` | Configure ad preloading | Called in adsense `callback` |
| `h5sdk.adBreak(options)` | Show interstitial/rewarded ads | Called in `showInterstitial()` / `showRewarded()` |
| `h5sdk.gameLoadingCompleted()` | Report game load time (mandatory) | Called on `PLATFORM_MESSAGE.GAME_READY` |
| `h5sdk.athenaSend(event, p1, p2)` | Custom event tracking | Available via `bridge.platform.sdk.athenaSend()` |

### h5sdk.init() Parameters

```js
window.h5sdk.init(appKey, top, left, bottom, right, options)
```

| Param | Type | Description |
|-------|------|-------------|
| `appKey` | number | Game unique identifier (from Dlightek upload form) |
| `top` | string | Empty string `''` |
| `left` | string | Empty string `''` |
| `bottom` | string | Empty string `''` |
| `right` | string | Empty string `''` |
| `options` | object | Contains `adsense` and optionally `ga` config |

### options.adsense Structure

```js
{
    client: 'ca-pub-1234567890',           // AdSense client ID
    'data-ad-frequency-hint': '45s',       // Min interval between ads
    'data-adbreak-test': 'on',             // Test mode (omit for production)
    'data-ad-channel': '987654321',        // Ad channel (optional)
    pauseCallback: () => { /* pause */ },  // Hot start: game paused
    resumeCallback: () => { /* resume */ },// Hot start: game resumed
    callback: () => {                      // Fires after SDK + Google init
        h5sdk.adConfig({ ... })
        h5sdk.adBreak({ ... })             // Optional preroll
    },
}
```

### adBreak Types

| Type | Usage |
|------|-------|
| `'preroll'` | Before game loading |
| `'start'` | After interface display — **used for interstitial** |
| `'pause'` | Player pauses game |
| `'next'` | Player moves to next level |
| `'browse'` | Player browsing options |
| `'reward'` | Rewarded ad — **used for rewarded** |

### adBreak Callbacks

| Callback | Description |
|----------|-------------|
| `beforeAd` | Called before ad shows — pause game, mute audio |
| `afterAd` | Called after ad closes — resume game |
| `beforeReward(showAdFn)` | Called when reward ad available — call `showAdFn()` to show |
| `adDismissed` | User closed reward ad early — no reward |
| `adViewed` | User watched full reward ad — grant reward |
| `adBreakDone(placementInfo)` | Always called last, even if no ad shown |

### adBreakDone breakStatus Values

| Status | Meaning |
|--------|---------|
| `'viewed'` | Ad was shown and completed |
| `'dismissed'` | User dismissed the ad |
| `'frequencyCapped'` | Too soon since last ad |
| `'noAdPreloaded'` | No ad was preloaded |
| `'error'` | Ad error |
| `'other'` | Other failure |

---

## Dlightek Platform Requirements

### Ad Review Requirements
- Interstitial ad pop-up interval must be **>= 1 minute** (bridge's `minimumDelayBetweenInterstitial` handles this, default 60s)
- No ads during active gameplay (only at natural break points)
- Rewarded ads must be skippable (not mandatory)
- Rewarded ads must have countdown/progress bar (handled by Google AFG)
- Banner ads not allowed on horizontal-only games
- Game loading time should be **under 8 seconds**
- `gameLoadingCompleted()` **must** be called (bridge handles this via `GAME_READY` message)
- Must access with `?env=pre` parameter at least once before submitting for review

### Offline / No-Network Resilience (Critical)

Games on Dlightek can be distributed as **offline packages** — users download once, then play without internet. The bridge implementation **must not block gameplay** when ads fail or network is unavailable.

**Requirements:**
1. **Splash/preroll ads must run concurrently** with game startup — game must not depend on or wait for ad completion
2. **Rewarded video failure must not affect gameplay** — only the reward is lost, game continues normally
3. **Interstitial failure must not prevent gameplay** from continuing
4. **No ad preloading at startup in offline mode** — if no network, skip all ad-related initialization and load the game directly

**How the bridge handles this:**
- The `_showAdFailurePopup()` method already handles ad failures gracefully (shows fallback popup or silently continues)
- `adBreakDone` callback fires even when no ad is shown, so state transitions always complete
- The `onReady` callback in `adConfig` may not fire in offline mode — **the initialization must handle this with a timeout or fallback** to ensure the bridge resolves even without network

**Implementation consideration for `initialize()`:**
The current init flow waits for `adConfig → onReady` before resolving. In offline mode, `onReady` may never fire because Google's script can't load. We should add a timeout fallback:

```js
// Inside addJavaScript().then():
const initTimeout = setTimeout(() => {
    // If onReady never fires (offline/no ads), resolve anyway
    if (!this._isInitialized) {
        this._playerApplyGuestData()
        this._isInitialized = true
        this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
    }
}, 5000) // 5 second timeout

// ...in the adsense callback:
callback: () => {
    this._platformSdk.adConfig({
        preloadAdBreaks: 'on',
        sound: 'on',
        onReady: () => {
            clearTimeout(initTimeout)
            this._playerApplyGuestData()
            this._isInitialized = true
            this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
        },
    })
},
```

Additionally, if `addJavaScript(sdkUrl)` itself fails (SDK script can't load offline), the `.catch()` handler should **resolve** instead of reject, so the game can still run:

```js
.catch((error) => {
    // In offline mode, SDK may fail to load — resolve anyway so game works
    console.warn('Dlightek SDK failed to load, continuing without ads:', error)
    this._playerApplyGuestData()
    this._isInitialized = true
    this._resolvePromiseDecorator(ACTION_NAME.INITIALIZE)
})
```

This ensures the bridge always initializes, with or without ads/network.

---

## Offline Package Specifications

Dlightek supports offline distribution where games are packaged as compressed archives for first-time download, then played without network.

### Package Structure

The offline package must use the **game domain name as the outermost folder**, then include all game files:

```
www.yourgamedomain.com/
├── game/
│   └── GameName/
│       ├── index.html          ← Required at project root
│       ├── assets/
│       │   ├── images/
│       │   ├── audio/
│       │   └── ...
│       ├── js/
│       │   └── game.js
│       └── ...
└── (other domains if needed)/
    └── core/
        └── ...
```

### Packaging Rules

1. **Root directory must contain `index.html`** and all game files
2. **Outermost folder = game domain name** (e.g., `www.test1.com/`)
3. **Third-party libraries from other domains** get their own domain folder (e.g., `www.test1core.com/core/xxx`)
4. **SDK and ad scripts should NOT be included** in the package — they load from network when available, and if unavailable, the game continues without them
5. **Resources that won't block the game** if they fail to load (ads, analytics) can be excluded from the package

### What to Exclude from Offline Package

These are loaded at runtime only when network is available:
- Dlightek SDK (`adsdk_*.js` from hippoobox.com)
- Google AdSense script (`adsbygoogle.js`)
- Athena tracking scripts
- Google gtag.js analytics
- Any CDN-hosted third-party libraries that aren't critical for gameplay

### Example

Game URL: `https://www.test1.com/game/Game1/index.html`
Game also uses: `https://www.test1core.com/core/xxx`

Package contents:
```
www.test1.com/
└── game/
    └── Game1/
        ├── index.html
        └── (all game assets)
www.test1core.com/
└── core/
    └── xxx
```

Reference example: `https://tstatic.ahagamecenter.com/resources/20230224/02414146619.zip`

---

## Verification

1. **Lint:** `npm run lint` — code style compliance (4-space indent, single quotes, no semicolons)
2. **Build:** `npm run build` — bundled build succeeds (single file with all platforms)
3. **Dynamic build:** `npm run build:dynamic` — code splitting creates `dist/platform-bridges/dlightek.js` chunk
4. **Platform build:** `npx webpack --env platform=dlightek` — single-platform build works
5. **Tests:** `npm test` — no regressions
6. **Manual test (online):** Set `?platform_id=dlightek&env=pre` and verify SDK lifecycle with Dlightek test environment
7. **Manual test (offline):** Disable network, verify bridge initializes and game runs without ads blocking gameplay
