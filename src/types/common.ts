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

// Common shared types used across modules and platform bridges.
// Extend during the gradual migration.

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export interface JsonObject { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

export type AnyRecord = Record<string, unknown>

// Storage
export type StorageKey = string | string[]
export type StorageValue = unknown | unknown[]

// Event mixin contract used by EventBus / PlatformBridgeBase / modules
export type EventListener = (...args: unknown[]) => void

export interface EventEmitter {
    on(eventName: string, callback: EventListener): void
    off(eventName: string, callback?: EventListener): void
    once(eventName: string, callback: EventListener): void
    emit(eventName: string, ...args: unknown[]): void
}

// User / player shapes
export interface GuestUser {
    id: string
    name: string
}

// Layout helpers
export interface SafeArea {
    top: number
    bottom: number
    left: number
    right: number
}

export interface AdvancedBannerConfig {
    width?: string
    height?: string
    top?: string
    bottom?: string
    left?: string
    right?: string
}

// Generic callback options bag used by various modules / platform bridges
export type CallbackOptions = AnyRecord
export type ModuleOptions = AnyRecord
