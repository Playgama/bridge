// UI fixture only: one local player, no network, authentication, migration or E2E coverage.
export function createMultiplayerFixture() {
    let initialized = false
    const enter = async ({ player }) => {
        let left = false
        let ready = true
        let configured = false
        const listeners = new Set()
        const players = [{ id: 'fixture-player', name: player.name, properties: player.properties || {} }]
        const state = () => ({
            connectionState: left ? 'disconnected' : 'connected',
            syncState: ready && !left ? 'ready' : 'syncing',
            isReady: ready && !left,
            isHost: configured && ready && !left,
        })
        const emit = () => listeners.forEach((callback) => callback(state()))
        const room = {
            id: 'fixture-room',
            playerId: 'fixture-player',
            inviteCode: 'K7M4X9TR',
            players,
            hostPlayerId: 'fixture-player',
            properties: {},
            get connectionState() { return state().connectionState },
            get isReady() { return state().isReady },
            get isHost() { return state().isHost },
            syncState({ getState, applyState }) {
                if (configured) throw Object.assign(new Error('Already configured'), { code: 'SYNC_ALREADY_CONFIGURED' })
                configured = true
                ready = false
                emit()
                applyState(JSON.parse(JSON.stringify(getState())))
                ready = true
                emit()
            },
            send() {
                if (left) throw Object.assign(new Error('Disconnected'), { code: 'NOT_CONNECTED' })
            },
            sendBytes() { room.send() },
            onMessage() { return () => {} },
            onMessageBytes() { return () => {} },
            onError() { return () => {} },
            onPlayersChange(callback) { callback(players); return () => {} },
            onRoomChange(callback) { callback(room); return () => {} },
            onStateChange(callback) {
                listeners.add(callback)
                callback(state())
                return () => listeners.delete(callback)
            },
            async setRoom(patch) { Object.assign(room.properties, patch.properties) },
            async setPlayer(properties) { Object.assign(players[0].properties, properties) },
            async leave() { left = true; ready = false; emit(); listeners.clear() },
        }
        return room
    }
    return {
        get isInitialized() { return initialized },
        async initialize() { initialized = true },
        multiplayer: {
            createRoom: enter,
            joinRoom: enter,
            joinOrCreateRoom: enter,
            async getRooms() { return { rooms: [], nextCursor: null } },
        },
    }
}
