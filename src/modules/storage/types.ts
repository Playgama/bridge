/*
 * This file is part of Playgama Bridge.
 *
 * Playgama Bridge is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * Playgama Bridge is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Playgama Bridge. If not, see <https://www.gnu.org/licenses/>.
 */

import type { PlatformBridgeLike } from '../ModuleBase'
import type { CloudStorageMode, StorageType } from './constants'

export interface StorageBridgeContract extends PlatformBridgeLike {
    defaultStorageType: StorageType
    cloudStorageMode: CloudStorageMode
    cloudStorageReady: Promise<void>
    _localStorage: Storage | null
    loadCloudSnapshot(): Promise<Record<string, unknown>>
    saveCloudSnapshot(snapshot: Record<string, unknown>, changedKeys: string[]): Promise<void>
    deleteCloudKeys(snapshot: Record<string, unknown>, deletedKeys: string[]): Promise<void>
    loadCloudKey(key: string): Promise<unknown>
    saveCloudKey(key: string, value: unknown): Promise<void>
    deleteCloudKey(key: string): Promise<void>
}
