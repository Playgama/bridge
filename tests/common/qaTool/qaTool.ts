import { MODULE_NAME } from '../../../src/constants'
import { ACTION_NAME_QA } from '../../../src/platform-bridges/QaToolPlatformBridge'
import { ACTION_NAME } from '../../../src/constants'
import type { TestGlobalThis } from '../../common/types'
import { StateManager } from '../stateManager/stateManager'
import type { QaToolMessageAuthorizePlayer, QaToolMessageAuthorizePlayerResponse, QaToolMessageData, QaToolMessageGetDataFromStorage, QaToolMessageGetDataFromStorageResponse, QaToolMessageGetPlayer, QaToolMessageGetPlayerResponse } from './qaTool.types'


export function createQaToolSdk(
    testGlobalThis: TestGlobalThis, 
    stateManager: StateManager
): Promise<void> {
    testGlobalThis.addEventListener('message', ({ data }) => {
        const messageData = data as QaToolMessageData

        if (messageData.source === 'platform' || !messageData.type || !messageData.action) return

        switch (messageData.type) {
            case MODULE_NAME.PLATFORM:
                break

            case MODULE_NAME.PLAYER:
                if (messageData.action === ACTION_NAME.AUTHORIZE_PLAYER) {
                    handleAuthorizePlayer(messageData as QaToolMessageAuthorizePlayer)
                } else if (messageData.action === ACTION_NAME_QA.GET_PLAYER) {
                    handleGetPlayer(messageData as QaToolMessageGetPlayer)
                } else {
                    console.error('Unsupported action', messageData.type, messageData.action)
                }
                break

            case 'liveness':
                break

            case MODULE_NAME.STORAGE:
                if (messageData.action === ACTION_NAME_QA.GET_DATA_FROM_STORAGE) {
                    handleGetDataFromStorage(messageData as QaToolMessageGetDataFromStorage)
                } else {
                    if (![
                        ACTION_NAME_QA.IS_STORAGE_AVAILABLE, 
                        ACTION_NAME_QA.IS_STORAGE_SUPPORTED
                    ].includes(messageData.action)) {
                        console.error('Unsupported action', messageData.type, messageData.action)
                    }
                }
                break

            default:
                console.error('Unsupported module', messageData.type)
                break
        }
    })

    function handleGetDataFromStorage(data: QaToolMessageGetDataFromStorage): void {
        const key = data.options.key
        const storageType = data.options.storageType

        const result: QaToolMessageGetDataFromStorageResponse['storage'] = {}
        if (Array.isArray(key)) {
            for (const k of key) {
                result[k] = stateManager.getStorageKey(storageType, k)
            }
        } else {
            result[key] = stateManager.getStorageKey(storageType, key)
        }

        const response: QaToolMessageGetDataFromStorageResponse = {
            type: data.type,
            action: data.action,
            id: data.id,
            source: 'platform',
            storage: result,
        }

        testGlobalThis.postMessage(response, '*')
    }

    function handleAuthorizePlayer(data: QaToolMessageAuthorizePlayer): void {
        const state = stateManager.getPlayerState()
        const response: QaToolMessageAuthorizePlayerResponse = {
            type: data.type,
            action: data.action,
            id: data.id,
            source: 'platform',
            auth: {
                status: state?.authorized ? 'success' : 'failed',
            }
        }
        testGlobalThis.postMessage(response, '*')
    }

    function handleGetPlayer(data: QaToolMessageGetPlayer): void {
        const state = stateManager.getPlayerState()
        let playerData: QaToolMessageGetPlayerResponse['player'] = null;

        if (state?.authorized) {
            playerData = {
                userId: state.id,
                name: state.name || '',
                isAuthorized: state.authorized,
                photos: state.photos || [],
                jwt: state.jwt || '',
            }
        }

        const response: QaToolMessageGetPlayerResponse = {
            type: data.type,
            action: data.action,
            id: data.id,
            source: 'platform',
            player: playerData,
        }

        testGlobalThis.postMessage(response, '*')
    }

    return Promise.resolve()
}
