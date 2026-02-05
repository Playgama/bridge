# Project: Playgama Bridge

Playgama Bridge is a unified cross-platform SDK for publishing HTML5 games to many gaming platforms. It provides a single API interface that abstracts platform-specific differences, enabling developers to integrate their games once and deploy across multiple platforms (Playgama, Crazy Games, Facebook, Telegram, Discord, Poki, etc.).

## Build Commands

```bash
npm run build          # Production build (bundled - single file)
npm run build:dynamic  # Production build with code splitting (separate chunk per platform)
npm run dev            # Dev server on port 3535
npm run develop        # Development build (non-minified)
npm run lint           # Check code style
npm run lint:fix       # Auto-fix linting issues
npm test               # Run tests once
npm run test:watch     # Run tests in watch mode
npx vitest tests/path/to/test.spec.ts  # Run single test file
```

## Architecture

### Initialization Flow

`src/index.js` → creates `PlaygamaBridge` → `initialize()`:
1. Loads config from `playgama-bridge-config.json` via `ConfigFileModule`
2. Detects platform via URL patterns/parameters (lines 266-307 in `PlaygamaBridge.js`)
3. Dynamically imports platform bridge via `platformImports.js`
4. Creates all feature modules with platform bridge reference
5. Calls `platformBridge.initialize()`

### Key Components

- **PlaygamaBridge** (`src/PlaygamaBridge.js`) - Main class, exposed as `window.bridge`
- **PlatformBridgeBase** (`src/platform-bridges/PlatformBridgeBase.js`) - Base class for all platform implementations
- **ModuleBase** (`src/modules/ModuleBase.js`) - Base class for feature modules
- **ConfigFileModule** - Singleton that loads/parses `playgama-bridge-config.json`
- **constants.js** - All enums (`PLATFORM_ID`, `EVENT_NAME`, `INTERSTITIAL_STATE`, etc.)

### Configuration Reference

See `docs/playgama-bridge-config.md` for complete configuration options including:
- Advertisement settings (interstitial, rewarded, banner)
- Game and device configuration
- Leaderboards and payments mappings
- SaaS configuration
- Platform-specific options (Yandex, VK, CrazyGames, Discord, Telegram, TikTok, etc.)

### Design Patterns

**Bridge Pattern**: Each platform extends `PlatformBridgeBase`, overriding getters like `platformId`, `isPaymentsSupported`, and methods like `showInterstitial()`.

**Event Mixin**: Both `PlatformBridgeBase` and modules use `EventLite.mixin(Class.prototype)` for event emission/subscription.

**State Aggregation**: `StateAggregator` in `PlatformBridgeBase` combines multiple pause/audio sources (interstitial, rewarded, visibility, platform) into single `PAUSE_STATE_CHANGED`/`AUDIO_STATE_CHANGED` events.

**Dynamic Imports**: `platformImports.js` maps `PLATFORM_ID` to lazy imports, enabling Webpack code splitting.

**SaaS Modules**: Some features (e.g., leaderboards) can use Playgama SaaS backend instead of native platform APIs. Check `#isSaas()` in `PlaygamaBridge.js`.

### Platform Detection Priority

1. `forciblySetPlatformId` in config
2. `platform_id` URL parameter
3. URL hostname/hash patterns (crazygames., tgWebAppData, etc.)
4. Global object detection (`window.TTMinis` for TikTok)
5. Falls back to `PLATFORM_ID.MOCK`

## Code Conventions

- 4-space indentation
- Single quotes for strings
- No semicolons (ESLint enforced)
- Max line length: 120 characters
- Protected properties: `_name`
- Private properties: `#name`
- Class member order: getters → protected props → private props → constructor → public methods → protected methods → private methods

## Adding a New Platform

1. Create `src/platform-bridges/NewPlatformBridge.js` extending `PlatformBridgeBase`
2. Override `get platformId()` returning value from `PLATFORM_ID`
3. Add platform ID to `PLATFORM_ID` enum in `constants.js`
4. Add import mapping in `platformImports.js`
5. Add detection logic in `PlaygamaBridge.js#createPlatformBridge()`
