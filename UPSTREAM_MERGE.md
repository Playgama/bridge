# Upgrading Over Upstream (Merge Skill)

> **Status:** synced with upstream **v2.1.0** on 2026-09-03 (previous sync: v2.0.1 on 2026-07-17).
> The codebase is now TypeScript; all custom features below live in `.ts` files.

When updating the bridge library from the official upstream (`Playgama/bridge`), strictly adhere to the following steps to preserve our custom features:

## 1. Fetch & Merge Upstream
```bash
git fetch upstream
git merge upstream/main --no-ff
```

## 2. Conflict Resolution Rules

### Loading screen (`src/lib/loading-screen/LoadingScreen.ts`)
**DO NOT** replace our cookie-splash loader with the default Playgama SVG logo.
The class keeps upstream's public API (`show`, `setProgress(percent, isFallback)`,
`setHideGate(promise)` — the loading-sound gate added in 2.1.0), but renders the fork's
`#cookie-splash` overlay. When upstream adds a method to its LoadingScreen, add it here too:
`PlaygamaBridge.ts` calls it unconditionally.

### Custom Platforms
Never remove or overwrite our exclusive integrations:
- **VK** (`VkPlatformBridge.ts`: `VKWebAppGetAuthToken` auth, storage retry-after-reauth, payments + external catalog `storage.choclategames.ru`, joinCommunity from config, `initialInterstitialDelay = 30`)
- **OK** (`OkPlatformBridge.ts` **extends VkPlatformBridge** — OK runs through VK Bridge; `ok-vk` params, no leaderboards, OK share fallback link)
- **GameMonetize** (`GameMonetizePlatformBridge.ts`, reward only on ad COMPLETE, launch interstitial after `AD_SDK_MANAGER_READY` + 500ms)
- **Android** (`AndroidPlatformBridge.ts`, Capacitor + YandexMobileAds)

### Detection Logic
Ensure `src/platformDetectors.ts` retains:
- OK detector (`vk_client=ok` / `vk_ok_app_id`) **before** the VK detector
- GameMonetize detector (gamemonetize.com/.co, distributegames.com)
- Android detector (`window.Capacitor.isNativePlatform()`)
- `ok-vk` → `ok` normalization in `normalizePlatformId`

And `src/modules/platform/constants.ts` retains `OK_VK`, `GAME_MONETIZE`, `ANDROID` in `PLATFORM_ID`,
`src/platformImports.ts` retains the GameMonetize/Android imports, and `src/globals.d.ts` the
`__INCLUDE_GAME_MONETIZE__` / `__INCLUDE_ANDROID__` flags.

### Other fork points
- `src/modules/advertisement/constants.ts` — `DEFAULT_MINIMUM_DELAY_BETWEEN_INTERSTITIAL = 80` (upstream: 60)
- `src/lib/bridge-config/BridgeConfig.ts` — top-level `<platformId>` config fallback + `ok-vk` merge for OK
- `src/modules/advertisement/dom.ts` — `showAdFailurePopup(platformId)` OK styling
- `src/PlaygamaBridge.ts` — `[Bridge] Platform detected` console.info
- `webpack.config.ts` — `CopyToUnityTemplatePlugin` (dist → UnityTemplate/)
- **npm package** — since the 2.1.0 sync `src/npm.ts`, `src/publicConstants.ts`, `src/global.ts`,
  `tsconfig.types.json` and the `--env npm` webpack configs are **upstream's** (take theirs on
  conflict). The fork keeps on top: `version` `<upstream>-fork.N`, the fork's `description` /
  `repository` / `bugs` / `homepage`, `build:package` that also runs `npm run build`
  (the release tarball ships `dist/playgama-bridge.js`), `build:deploy`, and in
  `webpack.config.ts` the npm bundles are built without `CopyToUnityTemplatePlugin`.
  `src/constantsEntry.ts` was removed (upstream uses `src/publicConstants.ts` as the entry).
  See `docs/npm-package.md`.
- **Release workflows** — upstream's `.github/workflows/release.yml` is deleted in the fork:
  `npm-release.yml` attaches both the npm tarball and `dist/playgama-bridge.js` to the release.
  Delete `release.yml` again if a merge brings it back.
- `src/PlaygamaBridge.ts` — module getters return their module type (`typeof storageModule`),
  not `unknown`. Without it the npm package cannot be used from TypeScript at all.

## 3. Post-Merge QA
1. **Install dependencies**: `npm install` (in case `package.json` changed).
2. **Fix line endings**: `npm run lint:fix` (solves standard CRLF/LF issues pushed by upstream).
3. **Verify**: Run `npm test` and `npm run build` to ensure tests pass and the bundle builds successfully before committing.
