import { MultiplayerError } from './types'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** MessagePack for the room server's control messages: JSON values and byte arrays. */
export function encodeMsgpack(value: unknown): Uint8Array {
    let buffer = new Uint8Array(256)
    let view = new DataView(buffer.buffer)
    let length = 0

    // Returns the offset to write at; buffer and view may be replaced, so read them after the call
    const reserve = (size: number): number => {
        if (length + size > buffer.length) {
            const next = new Uint8Array(Math.max(buffer.length * 2, length + size))
            next.set(buffer.subarray(0, length))
            buffer = next
            view = new DataView(buffer.buffer)
        }
        const at = length
        length += size
        return at
    }
    const byte = (code: number): void => {
        const at = reserve(1)
        buffer[at] = code
    }
    const number = (code: number, size: number, set: (at: number) => void): void => {
        byte(code)
        set(reserve(size))
    }
    const uint8 = (code: number, size: number): void => number(code, 1, (at) => view.setUint8(at, size))
    const uint16 = (code: number, size: number): void => number(code, 2, (at) => view.setUint16(at, size))
    const uint32 = (code: number, size: number): void => number(code, 4, (at) => view.setUint32(at, size))
    const bytes = (data: Uint8Array): void => {
        const at = reserve(data.length)
        buffer.set(data, at)
    }

    const write = (item: unknown): void => {
        if (item === null || item === undefined) {
            byte(0xc0)
        } else if (typeof item === 'boolean') {
            byte(item ? 0xc3 : 0xc2)
        } else if (typeof item === 'number') {
            if (!Number.isInteger(item) || item < -0x80000000 || item > 0xffffffff) {
                number(0xcb, 8, (at) => view.setFloat64(at, item))
            } else if (item >= 0) {
                if (item < 0x80) byte(item)
                else if (item <= 0xff) uint8(0xcc, item)
                else if (item <= 0xffff) uint16(0xcd, item)
                else uint32(0xce, item)
            } else if (item >= -0x20) {
                byte(item + 0x100)
            } else if (item >= -0x80) {
                number(0xd0, 1, (at) => view.setInt8(at, item))
            } else if (item >= -0x8000) {
                number(0xd1, 2, (at) => view.setInt16(at, item))
            } else {
                number(0xd2, 4, (at) => view.setInt32(at, item))
            }
        } else if (typeof item === 'string') {
            const data = textEncoder.encode(item)
            if (data.length < 0x20) byte(0xa0 + data.length)
            else if (data.length <= 0xff) uint8(0xd9, data.length)
            else if (data.length <= 0xffff) uint16(0xda, data.length)
            else uint32(0xdb, data.length)
            bytes(data)
        } else if (item instanceof Uint8Array) {
            if (item.length <= 0xff) uint8(0xc4, item.length)
            else if (item.length <= 0xffff) uint16(0xc5, item.length)
            else uint32(0xc6, item.length)
            bytes(item)
        } else if (Array.isArray(item)) {
            if (item.length < 0x10) byte(0x90 + item.length)
            else if (item.length <= 0xffff) uint16(0xdc, item.length)
            else uint32(0xdd, item.length)
            item.forEach(write)
        } else if (typeof item === 'object') {
            // Like JSON: undefined fields are left out
            const entries = Object.entries(item).filter(([, child]) => child !== undefined)
            if (entries.length < 0x10) byte(0x80 + entries.length)
            else if (entries.length <= 0xffff) uint16(0xde, entries.length)
            else uint32(0xdf, entries.length)
            entries.forEach(([key, child]) => {
                write(key)
                write(child)
            })
        } else {
            throw new MultiplayerError('INVALID_REQUEST', `Cannot encode ${typeof item}`)
        }
    }

    write(value)
    return buffer.slice(0, length)
}

/** Reads one MessagePack value at start; offset is where the next value begins. */
export function decodeMsgpack(data: Uint8Array, start = 0): { value: unknown; offset: number } {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = start

    const take = (size: number): number => {
        if (offset + size > data.length) throw new MultiplayerError('PROTOCOL_VIOLATION', 'Truncated MessagePack')
        const at = offset
        offset += size
        return at
    }
    const text = (size: number): string => {
        const at = take(size)
        return textDecoder.decode(data.subarray(at, at + size))
    }
    const binary = (size: number): Uint8Array => {
        const at = take(size)
        return data.slice(at, at + size)
    }
    // 64-bit integers become numbers, as the room server's MessagePack reads them
    const uint64 = (): number => {
        const at = take(8)
        return view.getUint32(at) * 0x100000000 + view.getUint32(at + 4)
    }
    const int64 = (): number => {
        const at = take(8)
        return view.getInt32(at) * 0x100000000 + view.getUint32(at + 4)
    }

    let read: () => unknown
    const array = (size: number): unknown[] => Array.from({ length: size }, () => read())
    const map = (size: number): Record<string, unknown> => {
        const result: Record<string, unknown> = {}
        for (let i = 0; i < size; i++) {
            const key = String(read())
            // defineProperty: a "__proto__" key stays a plain field
            Object.defineProperty(result, key, {
                value: read(),
                enumerable: true,
                writable: true,
                configurable: true,
            })
        }
        return result
    }

    read = (): unknown => {
        const code = view.getUint8(take(1))
        if (code < 0x80) return code
        if (code < 0x90) return map(code - 0x80)
        if (code < 0xa0) return array(code - 0x90)
        if (code < 0xc0) return text(code - 0xa0)
        if (code >= 0xe0) return code - 0x100
        switch (code) {
            case 0xc0: return null
            case 0xc2: return false
            case 0xc3: return true
            case 0xc4: return binary(view.getUint8(take(1)))
            case 0xc5: return binary(view.getUint16(take(2)))
            case 0xc6: return binary(view.getUint32(take(4)))
            case 0xca: return view.getFloat32(take(4))
            case 0xcb: return view.getFloat64(take(8))
            case 0xcc: return view.getUint8(take(1))
            case 0xcd: return view.getUint16(take(2))
            case 0xce: return view.getUint32(take(4))
            case 0xcf: return uint64()
            case 0xd0: return view.getInt8(take(1))
            case 0xd1: return view.getInt16(take(2))
            case 0xd2: return view.getInt32(take(4))
            case 0xd3: return int64()
            case 0xd9: return text(view.getUint8(take(1)))
            case 0xda: return text(view.getUint16(take(2)))
            case 0xdb: return text(view.getUint32(take(4)))
            case 0xdc: return array(view.getUint16(take(2)))
            case 0xdd: return array(view.getUint32(take(4)))
            case 0xde: return map(view.getUint16(take(2)))
            case 0xdf: return map(view.getUint32(take(4)))
            default: throw new MultiplayerError('PROTOCOL_VIOLATION', `Unsupported MessagePack type 0x${code.toString(16)}`)
        }
    }

    return { value: read(), offset }
}
