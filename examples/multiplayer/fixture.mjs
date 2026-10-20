// UI fixture only: one local player, no network, authentication, migration or E2E coverage.
export function createMultiplayerFixture() {
    let initialized = false
    let configuredModule = false
    const requireConfig = () => {
        if (!initialized) throw Object.assign(new Error('Initialize Bridge first'), { code: 'NOT_INITIALIZED' })
        if (!configuredModule) throw Object.assign(new Error('Missing multiplayer config'), { code: 'MULTIPLAYER_NOT_CONFIGURED' })
    }
    const enter = async ({ player }) => {
        requireConfig()
        let left = false
        let ready = true
        let configured = false
        let failure
        const listeners = new Set()
        const errorListeners = new Set()
        const playerListeners = new Set()
        const roomListeners = new Set()
        const players = [{ id: 'fixture-player', name: player.name, properties: player.properties || {} }]
        const state = () => ({
            connectionState: left ? 'disconnected' : 'connected',
            syncState: failure ? 'error' : ready && !left ? 'ready' : 'syncing',
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
                try {
                    const value = getState()
                    if (value?.then) {
                        Promise.resolve(value).catch(() => {})
                        throw new Error('getState must be synchronous')
                    }
                    const result = applyState(JSON.parse(JSON.stringify(value)))
                    if (result?.then) {
                        Promise.resolve(result).catch(() => {})
                        throw new Error('applyState must be synchronous')
                    }
                    ready = true
                    emit()
                } catch {
                    failure = Object.assign(new Error('Sync callback failed'), { code: 'SYNC_CALLBACK_FAILED' })
                    emit()
                    errorListeners.forEach((callback) => callback(failure))
                }
            },
            send() {
                if (left) throw Object.assign(new Error('Disconnected'), { code: 'NOT_CONNECTED' })
            },
            sendBytes() { room.send() },
            onMessage() { return () => {} },
            onMessageBytes() { return () => {} },
            onError(callback) {
                errorListeners.add(callback)
                if (failure) callback(failure)
                return () => errorListeners.delete(callback)
            },
            onPlayersChange(callback) {
                playerListeners.add(callback)
                callback(players)
                return () => playerListeners.delete(callback)
            },
            onRoomChange(callback) {
                roomListeners.add(callback)
                callback(room)
                return () => roomListeners.delete(callback)
            },
            onStateChange(callback) {
                listeners.add(callback)
                callback(state())
                return () => listeners.delete(callback)
            },
            async setRoom(patch) {
                Object.assign(room.properties, patch.properties)
                roomListeners.forEach((callback) => callback(room))
            },
            async setPlayer(properties) {
                Object.assign(players[0].properties, properties)
                playerListeners.forEach((callback) => callback(players))
            },
            async leave() {
                left = true
                ready = false
                emit()
                listeners.clear()
                errorListeners.clear()
                playerListeners.clear()
                roomListeners.clear()
            },
        }
        return room
    }
    return {
        get isInitialized() { return initialized },
        async initialize(options = {}) {
            if (initialized) return
            initialized = true
            configuredModule = Boolean(options.multiplayer)
        },
        multiplayer: {
            get isSupported() { return configuredModule },
            createRoom: enter,
            joinRoom: enter,
            joinOrCreateRoom: enter,
            async getRooms() { requireConfig(); return { rooms: [], nextCursor: null } },
        },
    }
}
