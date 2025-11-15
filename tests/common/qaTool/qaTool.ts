import { MODULE_NAME } from '../../../src/constants'
import { ACTION_NAME_QA } from '../../../src/platform-bridges/QaToolPlatformBridge'
import { ACTION_NAME } from '../../../src/constants'
import type { TestGlobalThis } from '../../common/types'
import { StateManager } from '../stateManager/stateManager'
import type { QaToolMessageAuthorizePlayer, QaToolMessageAuthorizePlayerResponse, QaToolMessageData, QaToolMessageGetDataFromStorage, QaToolMessageGetDataFromStorageResponse } from './qaTool.types'


export function createQaToolSdk(
    testGlobalThis: TestGlobalThis, 
    stateManager: StateManager
): Promise<void> {
    testGlobalThis.addEventListener('message', ({ data }) => {
        const messageData = data as QaToolMessageData

        if (messageData.source === 'platform' || !messageData.type || !messageData.action) return

        if (messageData.type === MODULE_NAME.PLATFORM) {
            // 
        } 
        else if (messageData.type === MODULE_NAME.PLAYER) {
            if (messageData.action === ACTION_NAME.AUTHORIZE_PLAYER) {
                handleAuthorizePlayer(messageData as QaToolMessageAuthorizePlayer)
            } else {
                console.error('Unsupported action', messageData.type, messageData.action)
            }
        }
        else if (messageData.type === 'liveness') {
            // 
        }
        else if (messageData.type === MODULE_NAME.STORAGE) {
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
        } else {
            console.error('Unsupported module', messageData.type)
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
            },
            player: state?.authorized ? {
                id: state.id || '',
                name: state.name || '',
                isAuthorized: state.authorized,
                photos: state.photos || [],
                extra: state.extra || {},
            } : null,
        }
        testGlobalThis.postMessage(response, '*')
    }

    return Promise.resolve()
}
