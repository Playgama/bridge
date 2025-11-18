import { MODULE_NAME, STORAGE_TYPE, ACTION_NAME } from "../../../src/constants"
import { ACTION_NAME_QA } from "../../../src/platform-bridges/QaToolPlatformBridge"

export interface QaToolMessageDataBase {
    source: string
    id: string
}

export interface QaToolMessageGetDataFromStorage extends QaToolMessageDataBase {
    type: typeof MODULE_NAME.STORAGE
    action: typeof ACTION_NAME_QA.GET_DATA_FROM_STORAGE
    options: {
        key: string | string[]
        storageType: typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL
        tryParseJson: boolean
    }
}

export interface QaToolMessageGetDataFromStorageResponse extends QaToolMessageDataBase {
    type: typeof MODULE_NAME.STORAGE
    action: typeof ACTION_NAME_QA.GET_DATA_FROM_STORAGE
    storage: { [key: string]: string | undefined }
}

// export interface QaToolMessageSetDataToStorage extends QaToolMessageDataBase {
//     type: typeof MODULE_NAME.STORAGE
//     action: typeof ACTION_NAME_QA.SET_DATA_TO_STORAGE
//     options: {
//         key: string | string[]
//         value: unknown | unknown[]
//         storageType: typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL
//     }
// }

// export interface QaToolMessageDeleteDataFromStorage extends QaToolMessageDataBase {
//     type: typeof MODULE_NAME.STORAGE
//     action: typeof ACTION_NAME_QA.DELETE_DATA_FROM_STORAGE
//     options: {
//         key: string | string[]
//         storageType: typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL
//     }
// }

// export interface QaToolMessageIsStorageSupported extends QaToolMessageDataBase {
//     type: typeof MODULE_NAME.STORAGE
//     action: typeof ACTION_NAME_QA.IS_STORAGE_SUPPORTED
//     options: {
//         storageType: typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL
//     }
// }

// export interface QaToolMessageIsStorageAvailable extends QaToolMessageDataBase {
//     type: typeof MODULE_NAME.STORAGE
//     action: typeof ACTION_NAME_QA.IS_STORAGE_AVAILABLE
//     options: {
//         storageType: typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL
//     }
// }

// Player module messages
export interface QaToolMessageAuthorizePlayer extends QaToolMessageDataBase {
    type: typeof MODULE_NAME.PLAYER
    action: typeof ACTION_NAME.AUTHORIZE_PLAYER
    options?: Record<string, unknown>
}

export interface QaToolMessageAuthorizePlayerResponse extends QaToolMessageDataBase {
    type: typeof MODULE_NAME.PLAYER
    action: typeof ACTION_NAME.AUTHORIZE_PLAYER
    auth: {
        status: 'success' | 'failed'
    }
    player: {
        id: string
        name: string
        isAuthorized: boolean
        photos: string[]
        extra: Record<string, unknown>
    } | null
}

// // Platform module messages
// export interface QaToolMessageGetServerTime extends QaToolMessageDataBase {
//     type: typeof MODULE_NAME.PLATFORM
//     action: typeof ACTION_NAME_QA.GET_SERVER_TIME
//     options: {}
// }

// Union type for all QaTool messages
export type QaToolMessageData =
    | QaToolMessageGetDataFromStorage
    // | QaToolMessageSetDataToStorage
    // | QaToolMessageDeleteDataFromStorage
    // | QaToolMessageIsStorageSupported
    // | QaToolMessageIsStorageAvailable
    // | QaToolMessageAuthorizePlayer
    // | QaToolMessageGetServerTime