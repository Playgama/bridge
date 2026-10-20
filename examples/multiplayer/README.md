# Experimental multiplayer

This branch is staging-only. The facade and public game token are explicit opt-in configuration;
the ordinary Bridge production endpoints are unchanged. `apiBase` below is the facade root.
The SDK obtains the regional base from `sessions` and routes invitation codes internally.
The public app token identifies the game; never put a management credential here.

```js
if (!bridge.isInitialized) {
    await bridge.initialize({
        multiplayer: {
            apiBase: 'https://staging.playgama.com/api/bridge/v1/relay',
            appToken: PUBLIC_GAME_TOKEN,
            environment: 'staging',
            region: 'eu',
        },
    })
}

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

The browser artifact uses `window.bridge`. Copy the entire dynamic build directory,
including its chunks, preserving relative paths. The multiplayer runtime and Colyseus
are fetched on first use; importing the Bridge alone does not create a session.

`fixture.mjs` exports `createMultiplayerFixture()` for isolated UI development. It has
one local host and does not contact any backend. Its success is **not** an E2E test.
The authoritative public types are `src/modules/multiplayer/types.ts`.
