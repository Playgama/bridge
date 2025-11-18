import { STORAGE_TYPE } from "../../../src/constants"

export interface PlayerState {
    authorized: boolean
    id: string
    name?: string
    photos?: string[]
    extra?: Record<string, unknown>
}

export type StorageStateType = typeof STORAGE_TYPE.LOCAL_STORAGE | typeof STORAGE_TYPE.PLATFORM_INTERNAL

