# Changes: Home Screen Reward — Rename & Promise Behavior

## Summary

Renamed `isHomeScreenShortcutRewardSupported` and `getHomeScreenShortcutMissionReward()` to align with the existing `isAddToHomeScreenSupported` / `addToHomeScreen` naming convention. Additionally, changed the promise behavior so that `getAddToHomeScreenReward()` resolves only when a reward is available and rejects in all other cases, removing the need to pass a boolean parameter in resolve.

---

## Renames

| Old Name | New Name |
|---|---|
| `isHomeScreenShortcutRewardSupported` | `isAddToHomeScreenRewardSupported` |
| `getHomeScreenShortcutMissionReward()` | `getAddToHomeScreenReward()` |

---

## Files Changed

### 1. `src/platform-bridges/PlatformBridgeBase.js`

#### Getter rename (line 167)

**Before:**
```js
get isHomeScreenShortcutRewardSupported() {
    return false
}
```

**After:**
```js
get isAddToHomeScreenRewardSupported() {
    return false
}
```

#### Method rename + reject behavior (line 516)

**Before:**
```js
getHomeScreenShortcutMissionReward() {
    return Promise.resolve(false)
}
```

**After:**
```js
getAddToHomeScreenReward() {
    return Promise.reject()
}
```

Changed from `Promise.resolve(false)` to `Promise.reject()` to match the pattern used by all other unsupported methods in the base class (`addToHomeScreen()`, `addToFavorites()`, `rate()`, etc.).

---

### 2. `src/platform-bridges/TikTokPlatformBridge.js`

#### Getter rename (line 80)

**Before:**
```js
get isHomeScreenShortcutRewardSupported() {
    if (this._platformSdk && this._platformSdk.canIUse('getShortcutMissionReward')) {
        return true
    }
    ...
}
```

**After:**
```js
get isAddToHomeScreenRewardSupported() {
    if (this._platformSdk && this._platformSdk.canIUse('getShortcutMissionReward')) {
        return true
    }
    ...
}
```

#### Method rename + promise behavior change (line 348)

**Before:**
```js
getHomeScreenShortcutMissionReward() {
    if (!this._platformSdk || !this._platformSdk.canIUse('getShortcutMissionReward')) {
        return Promise.resolve(false)
    }

    return new Promise((resolve) => {
        this._platformSdk.getShortcutMissionReward({
            success: (res) => {
                resolve(res?.canReceiveReward ?? false)
            },
            fail: () => {
                resolve(false)
            },
        })
    })
}
```

**After:**
```js
getAddToHomeScreenReward() {
    if (!this._platformSdk || !this._platformSdk.canIUse('getShortcutMissionReward')) {
        return Promise.reject()
    }

    return new Promise((resolve, reject) => {
        this._platformSdk.getShortcutMissionReward({
            success: (res) => {
                if (res?.canReceiveReward) {
                    resolve()
                } else {
                    reject()
                }
            },
            fail: () => {
                reject()
            },
        })
    })
}
```

Three changes here:
1. **SDK unavailable guard** — changed from `Promise.resolve(false)` to `Promise.reject()`
2. **Success callback** — instead of always resolving with a boolean, now resolves with no args when `canReceiveReward` is truthy, rejects otherwise
3. **Fail callback** — changed from `resolve(false)` to `reject()`

---

### 3. `src/modules/SocialModule.js`

#### Getter rename (line 41)

**Before:**
```js
get isHomeScreenShortcutRewardSupported() {
    return this._platformBridge.isHomeScreenShortcutRewardSupported
}
```

**After:**
```js
get isAddToHomeScreenRewardSupported() {
    return this._platformBridge.isAddToHomeScreenRewardSupported
}
```

#### Method rename (line 105)

**Before:**
```js
getHomeScreenShortcutMissionReward() {
    return this._platformBridge.getHomeScreenShortcutMissionReward()
}
```

**After:**
```js
getAddToHomeScreenReward() {
    return this._platformBridge.getAddToHomeScreenReward()
}
```

Passthrough only — delegates to the platform bridge.

---

## API Usage

### Before
```js
const canReceive = await bridge.social.getHomeScreenShortcutMissionReward()
if (canReceive) {
    // grant reward
}
```

### After
```js
bridge.social.getAddToHomeScreenReward()
    .then(() => {
        // reward is available — grant it
    })
    .catch(() => {
        // reward not available or not supported
    })
```

Or with async/await:
```js
try {
    await bridge.social.getAddToHomeScreenReward()
    // reward is available — grant it
} catch {
    // reward not available or not supported
}
```

---

## Naming Consistency

The renamed API now aligns with the existing home screen methods:

| Getter | Method |
|---|---|
| `isAddToHomeScreenSupported` | `addToHomeScreen()` |
| `isAddToHomeScreenRewardSupported` | `getAddToHomeScreenReward()` |
