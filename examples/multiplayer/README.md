# Experimental multiplayer

This branch is staging-only. The facade and public game token are explicit opt-in configuration;
the ordinary Bridge production endpoints are unchanged. `apiBase` below is the facade root.
The SDK obtains the regional base from `sessions` and routes invitation codes internally.
The public app token identifies the game; never put a management credential here.

```js
// Add this block to the game's ORIGINAL Bridge initialization.
// If Bridge is initialized elsewhere, merge the config there before loading this code.
await bridge.initialize({
        multiplayer: {
            apiBase: 'https://staging.playgama.com/api/bridge/v1/relay',
            appToken: PUBLIC_GAME_TOKEN,
            environment: 'staging',
            region: 'eu',
        },
})

const room = await bridge.multiplayer.joinOrCreateRoom({
    player: { name: 'Player' },
    maxPlayers: 4,
    gameVersion: 'quick-pong-v1',
})
// Alternatively: createRoom(options), or joinRoom({ code, player, gameVersion }).
room.onMessage(({ type, data, from }) => {
    if (room.isHost && type === 'input') applyPlayerInput(from, data)
})
room.syncState({
    getState: () => world,
    applyState: (state) => { world = state },
})
// In the existing game loop:
if (room.isHost) simulateWorld()
// Send local input only when ready; from is authenticated by the server.
if (room.isReady && room.hostPlayerId) room.send('input', input, room.hostPlayerId)
```

`getState` and `applyState` must be synchronous. Include all state required to continue the
game (RNG, timers, inputs already consumed, entities). `isHost` includes readiness and
server activation, so one gate is sufficient for simulation.

Players are `{ id, name, properties }`; `room.playerId` identifies the local player.
`onStateChange` immediately emits `{ connectionState, syncState, isReady, isHost }`.
Connection state is `connected | reconnecting | disconnected`; sync state is
`syncing | ready | error`. Connected transport may still be awaiting a world snapshot.
`onPlayersChange` and `onRoomChange` also emit their current values immediately.
Subscriptions return an unsubscribe function and survive reconnect.
`onError` receives an Error with a string `code`. A terminal sync error is replayed to
late error subscribers. Messages have no replay.

`send(type, json, to = 'others')` encodes JSON in the SDK. `sendBytes` and
`onMessageBytes` expose the raw binary alternative. `to` is `others`, a player UUID,
or an array of UUIDs; there is no wire alias for the host.
`room.inviteCode` comes only from welcome. Do not include it in telemetry.
`await room.leave()` stops local simulation/reconnect immediately and confirms the exit
through HTTP. `setRoom` and `setPlayer` wait for server acknowledgement.

The browser artifact uses `window.bridge`. Ordinary bundled and platform builds produce
`playgama-bridge.js` and the optional `platform-bridges/multiplayer.js`. Deploy both from
the same compilation, preserving these relative paths. Do not mix addons from different
builds, including different platforms. Dynamic builds also require their platform chunks.
The multiplayer runtime and Colyseus
are fetched on first use; importing the Bridge alone does not create a session.
For a game that already initializes Bridge, add `multiplayer` to that original call
or its local Bridge config and reload the page. A second `initialize()` does not
change an initialized Bridge. `bridge.multiplayer.isSupported` reports whether
the module has opt-in config. Missing config rejects multiplayer operations with
`MULTIPLAYER_NOT_CONFIGURED` before any network request.

The authoritative public types are `src/modules/multiplayer/types.ts`.

For GitHub Releases, extract `playgama-bridge.zip` to keep the matching pair and paths.
The separate historical `playgama-bridge.js` attachment supports the core features alone.
The npm package includes both files. The Vite plugin serves/copies them with
`playgamaBridge({ mode: 'local' })`; its default CDN mode still selects the existing
stable CDN runtime, not this experimental build. This branch does not publish to that CDN.

## Validation

Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
The browser artifact is `dist/playgama-bridge.js` plus
`dist/platform-bridges/multiplayer.js`; `publicPath` is resolved from the script URL.
Do not run the build while serving these files to a test browser.

`node tests/multiplayer-browser/packaging.mjs [artifact-directory]` checks ordinary
core initialization, lazy concurrent loading and retry after a missing addon in Chrome.
It deliberately rejects HTTP with a packaging sentinel; it is not a multiplayer E2E test.

The real browser suite is `npm run test:multiplayer:browser`, with:

- `MP_API_BASE`: the running local facade root, such as `http://127.0.0.1:3300/api/bridge/v1/relay`.
- `MP_PUBLIC_TOKEN`: the public test game token registered in that facade.
- `MP_SERVER_ROOT`: the server worktree containing its `scripts/local-stack.mjs`
  hook. The crash test deliberately restarts that local server; coordinate its use.
- `MP_BROWSER_PATH`: optional Chrome executable (default `/usr/bin/google-chrome`).

Allow `http://127.0.0.1:4178` in the test game's origins. The suite serves
`harness.html` and uses independent browser contexts for different players;
the cloned-tab test deliberately copies session storage to test replacement.
It tests actual HTTP/WS, lazy chunks, invite/matching, JSON relay, late snapshots,
host migration, native return, HTTP fallback, terminal replacement, leave during
HTTP outage and process recovery. State comparisons use a frozen world.
Without the server hook, process recovery is explicitly skipped. Missing API or
public token fails configuration; it never substitutes a fixture.

The harness's local config uses the `mock` **platform adapter** and disables core
analytics. Multiplayer still uses the real facade and official Colyseus SDK.
Browser requests outside loopback are blocked; platform account verification and
public staging routing are separate deployment checks.

Explicit leave immediately closes the local transport and cancels recovery.
Its promise resolves only after the independent, idempotent HTTP leave confirms
membership release; transient HTTP failure cannot keep an abandoned host socket alive.
