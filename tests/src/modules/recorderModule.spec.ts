import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { RecorderModule } from '../../../src/modules/RecorderModule'

function createRecorderModule() {
    return new RecorderModule()
}

function createMockCanvas(options: { toDataURL?: string } = {}) {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'toDataURL').mockReturnValue(options.toDataURL || 'data:image/png;base64,mockData')
    canvas.captureStream = vi.fn().mockReturnValue({
        getTracks: () => [{ stop: vi.fn() }],
    })
    document.body.appendChild(canvas)
    return canvas
}

function createMockRTCPeerConnection() {
    const setParameters = vi.fn().mockResolvedValue(undefined)
    const mockSender = {
        track: { kind: 'video' },
        getParameters: vi.fn().mockReturnValue({ encodings: [{}] }),
        setParameters,
    }
    const mockPc = {
        addTrack: vi.fn(),
        createOffer: vi.fn().mockResolvedValue({ sdp: 'mock-offer-sdp', type: 'offer' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        setRemoteDescription: vi.fn(),
        remoteDescription: null as RTCSessionDescriptionInit | null,
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
        getSenders: vi.fn().mockReturnValue([mockSender]),
        close: vi.fn(),
        onicecandidate: null as ((e: { candidate: unknown }) => void) | null,
    }
    mockPc.setRemoteDescription.mockImplementation(async (description) => {
        mockPc.remoteDescription = description
    })

    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPc) as unknown as typeof RTCPeerConnection
    return mockPc
}

describe('RecorderModule', () => {
    let canvas: HTMLCanvasElement | null = null

    beforeEach(() => {
        vi.restoreAllMocks()
        HTMLCanvasElement.prototype.captureStream = vi.fn()
        global.RTCSessionDescription = vi.fn().mockImplementation((desc) => desc) as unknown as typeof RTCSessionDescription
        global.RTCIceCandidate = vi.fn().mockImplementation((c) => c) as unknown as typeof RTCIceCandidate
    })

    afterEach(() => {
        if (canvas) {
            canvas.remove()
            canvas = null
        }
        // @ts-expect-error cleanup
        delete global.RTCPeerConnection
        // @ts-expect-error cleanup
        delete global.RTCSessionDescription
        // @ts-expect-error cleanup
        delete global.RTCIceCandidate
    })

    describe('checkAvailability', () => {
        test('should return unavailable when RTCPeerConnection is not defined', () => {
            canvas = createMockCanvas()
            // RTCPeerConnection not defined (deleted in afterEach)

            const module = createRecorderModule()
            const result = module.checkAvailability()

            expect(result).toEqual({ available: false, reason: 'RTCPeerConnection is not supported' })
        })

        test('should return unavailable when captureStream is not supported', () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()
            // @ts-expect-error remove captureStream
            delete HTMLCanvasElement.prototype.captureStream

            const module = createRecorderModule()
            const result = module.checkAvailability()

            expect(result).toEqual({ available: false, reason: 'captureStream is not supported' })
        })

        test('should return unavailable when canvas is not found', () => {
            createMockRTCPeerConnection()

            const module = createRecorderModule()
            const result = module.checkAvailability()

            expect(result).toEqual({ available: false, reason: 'Canvas not found' })
        })

        test('should return available when all conditions are met', () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()

            const module = createRecorderModule()
            const result = module.checkAvailability()

            expect(result).toEqual({ available: true, reason: null })
        })
    })

    describe('startCapture', () => {
        test('should call onError when not available', async () => {
            createMockRTCPeerConnection()
            const onError = vi.fn()

            const module = createRecorderModule()
            module.onError = onError
            await module.startCapture()

            expect(onError).toHaveBeenCalledWith('Canvas not found')
        })

        test('should create peer connection and generate offer', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const onOffer = vi.fn()
            const onStarted = vi.fn()

            const module = createRecorderModule()
            module.onOffer = onOffer
            module.onStarted = onStarted
            await module.startCapture()

            expect(mockPc.createOffer).toHaveBeenCalled()
            expect(mockPc.setLocalDescription).toHaveBeenCalled()
            expect(onOffer).toHaveBeenCalledWith('mock-offer-sdp')
            expect(onStarted).toHaveBeenCalled()
        })

        test('should use custom fps', async () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()

            const module = createRecorderModule()
            await module.startCapture({ fps: 60 })

            expect(canvas.captureStream).toHaveBeenCalledWith(60)
        })

        test('should use default fps of 30', async () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()

            const module = createRecorderModule()
            await module.startCapture()

            expect(canvas.captureStream).toHaveBeenCalledWith(30)
        })

        test('should stop the stream when peer connection creation fails', async () => {
            const stop = vi.fn()
            canvas = createMockCanvas()
            canvas.captureStream = vi.fn().mockReturnValue({
                getTracks: () => [{ stop }],
            })
            global.RTCPeerConnection = vi.fn().mockImplementation(() => {
                throw new Error('Peer connection creation failed')
            }) as unknown as typeof RTCPeerConnection

            const module = createRecorderModule()

            await expect(module.startCapture()).rejects.toThrow('Peer connection creation failed')
            expect(stop).toHaveBeenCalledOnce()
        })

        test('should release capture resources when offer creation fails', async () => {
            const stop = vi.fn()
            canvas = createMockCanvas()
            canvas.captureStream = vi.fn().mockReturnValue({
                getTracks: () => [{ stop }],
            })
            const mockPc = createMockRTCPeerConnection()
            mockPc.createOffer = vi.fn().mockRejectedValue(new Error('Offer creation failed'))

            const module = createRecorderModule()

            await expect(module.startCapture()).rejects.toThrow('Offer creation failed')
            expect(stop).toHaveBeenCalledOnce()
            expect(mockPc.close).toHaveBeenCalledOnce()
        })

        test('should apply maxBitrate to video sender', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const sender = mockPc.getSenders()[0]

            const module = createRecorderModule()
            await module.startCapture({ maxBitrate: 5000000 })

            expect(sender.getParameters).toHaveBeenCalled()
            expect(sender.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({
                    encodings: [{ maxBitrate: 5000000 }],
                }),
            )
        })

        test('should apply minBitrate to video sender', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const sender = mockPc.getSenders()[0]

            const module = createRecorderModule()
            await module.startCapture({ minBitrate: 1000000 })

            expect(sender.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({
                    encodings: [{ minBitrate: 1000000 }],
                }),
            )
        })

        test('should apply both maxBitrate and minBitrate', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const sender = mockPc.getSenders()[0]

            const module = createRecorderModule()
            await module.startCapture({ maxBitrate: 5000000, minBitrate: 1000000 })

            expect(sender.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({
                    encodings: [{ maxBitrate: 5000000, minBitrate: 1000000 }],
                }),
            )
        })

        test('should call setParameters without bitrate fields when not specified', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const sender = mockPc.getSenders()[0]

            const module = createRecorderModule()
            await module.startCapture()

            expect(sender.setParameters).toHaveBeenCalledWith(
                expect.objectContaining({ encodings: [{}] }),
            )
        })

        test('should forward ice candidates', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const onIceCandidate = vi.fn()
            const mockCandidate = { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 }

            const module = createRecorderModule()
            module.onIceCandidate = onIceCandidate
            await module.startCapture()

            mockPc.onicecandidate?.({
                candidate: { toJSON: () => mockCandidate },
            })

            expect(onIceCandidate).toHaveBeenCalledWith(mockCandidate)
        })

        test('should not forward null ice candidates', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            const onIceCandidate = vi.fn()

            const module = createRecorderModule()
            module.onIceCandidate = onIceCandidate
            await module.startCapture()

            mockPc.onicecandidate?.({ candidate: null })

            expect(onIceCandidate).not.toHaveBeenCalled()
        })

        test('should not throw when callbacks are not set', async () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()

            const module = createRecorderModule()
            await expect(module.startCapture()).resolves.toBeUndefined()
        })

        test('should not emit an old offer after a newer capture starts', async () => {
            canvas = createMockCanvas()
            const firstPc = createMockRTCPeerConnection()
            const secondPc = createMockRTCPeerConnection()
            let resolveFirstOffer!: (offer: RTCSessionDescriptionInit) => void
            firstPc.createOffer = vi.fn(() => new Promise((resolve) => {
                resolveFirstOffer = resolve
            }))
            secondPc.createOffer = vi.fn().mockResolvedValue({
                sdp: 'fresh-offer-sdp',
                type: 'offer',
            })
            global.RTCPeerConnection = vi.fn()
                .mockImplementationOnce(() => firstPc)
                .mockImplementationOnce(() => secondPc) as unknown as typeof RTCPeerConnection
            const onOffer = vi.fn()
            const onIceCandidate = vi.fn()
            const onStarted = vi.fn()
            const module = createRecorderModule()
            module.onOffer = onOffer
            module.onIceCandidate = onIceCandidate
            module.onStarted = onStarted

            const firstStart = module.startCapture()
            await vi.waitFor(() => expect(firstPc.createOffer).toHaveBeenCalled())
            module.stopCapture()
            await module.startCapture()
            resolveFirstOffer({ sdp: 'stale-offer-sdp', type: 'offer' })
            await firstStart
            firstPc.onicecandidate?.({
                candidate: { toJSON: () => ({ candidate: 'stale-candidate' }) },
            })
            secondPc.onicecandidate?.({
                candidate: { toJSON: () => ({ candidate: 'fresh-candidate' }) },
            })

            expect(onOffer).toHaveBeenCalledOnce()
            expect(onOffer).toHaveBeenCalledWith('fresh-offer-sdp')
            expect(onIceCandidate).toHaveBeenCalledOnce()
            expect(onIceCandidate).toHaveBeenCalledWith({ candidate: 'fresh-candidate' })
            expect(onStarted).toHaveBeenCalledOnce()
            expect(firstPc.setLocalDescription).not.toHaveBeenCalled()
        })
    })

    describe('handleAnswer', () => {
        test('should set remote description after startCapture', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()

            const module = createRecorderModule()
            await module.startCapture()
            await module.handleAnswer({ sdp: 'mock-answer-sdp' })

            expect(mockPc.setRemoteDescription).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'answer', sdp: 'mock-answer-sdp' }),
            )
        })

        test('should do nothing when peer connection does not exist', async () => {
            const module = createRecorderModule()
            await expect(module.handleAnswer({ sdp: 'mock-answer-sdp' })).resolves.toBeUndefined()
        })
    })

    describe('handleIce', () => {
        test('should add ice candidate after remote answer is set', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()

            const candidate = { candidate: 'mock', sdpMid: '0', sdpMLineIndex: 0 }
            const module = createRecorderModule()
            await module.startCapture()
            await module.handleAnswer({ sdp: 'mock-answer-sdp' })
            await module.handleIce(candidate)

            expect(mockPc.addIceCandidate).toHaveBeenCalled()
        })

        test('should queue ice candidate while remote answer is being set', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()
            let resolveRemoteDescription!: () => void
            mockPc.setRemoteDescription.mockImplementation((description) => new Promise<void>((resolve) => {
                resolveRemoteDescription = () => {
                    mockPc.remoteDescription = description
                    resolve()
                }
            }))

            const candidate = { candidate: 'early', sdpMid: '0', sdpMLineIndex: 0 }
            const module = createRecorderModule()
            await module.startCapture()
            const answerPromise = module.handleAnswer({ sdp: 'mock-answer-sdp' })
            await vi.waitFor(() => expect(mockPc.setRemoteDescription).toHaveBeenCalled())

            await module.handleIce(candidate)
            expect(mockPc.addIceCandidate).not.toHaveBeenCalled()

            resolveRemoteDescription()
            await answerPromise
            expect(mockPc.addIceCandidate).toHaveBeenCalledWith(candidate)
        })

        test('should discard queued ice candidates when capture stops', async () => {
            canvas = createMockCanvas()
            const firstPc = createMockRTCPeerConnection()
            const secondPc = createMockRTCPeerConnection()
            global.RTCPeerConnection = vi.fn()
                .mockImplementationOnce(() => firstPc)
                .mockImplementationOnce(() => secondPc) as unknown as typeof RTCPeerConnection

            const module = createRecorderModule()
            await module.startCapture()
            await module.handleIce({ candidate: 'stale', sdpMid: '0', sdpMLineIndex: 0 })
            module.stopCapture()
            await module.startCapture()
            await module.handleAnswer({ sdp: 'fresh-answer-sdp' })

            expect(firstPc.addIceCandidate).not.toHaveBeenCalled()
            expect(secondPc.addIceCandidate).not.toHaveBeenCalled()
        })

        test('should do nothing when peer connection does not exist', async () => {
            const module = createRecorderModule()
            await expect(module.handleIce({ candidate: 'mock' })).resolves.toBeUndefined()
        })

        test('should do nothing when candidate is null', async () => {
            canvas = createMockCanvas()
            const mockPc = createMockRTCPeerConnection()

            const module = createRecorderModule()
            await module.startCapture()
            await module.handleIce(null)

            expect(mockPc.addIceCandidate).not.toHaveBeenCalled()
        })
    })

    describe('takeScreenshot', () => {
        test('should return error when canvas is not found', () => {
            const module = createRecorderModule()
            const result = module.takeScreenshot()

            expect(result).toEqual({ success: false, reason: 'Canvas not found', data: null })
        })

        test('should return base64 data from canvas', () => {
            canvas = createMockCanvas({ toDataURL: 'data:image/png;base64,screenshotData' })

            const module = createRecorderModule()
            const result = module.takeScreenshot()

            expect(result).toEqual({
                success: true,
                reason: null,
                data: 'data:image/png;base64,screenshotData',
            })
        })

        test('should use default type and quality', () => {
            canvas = createMockCanvas()

            const module = createRecorderModule()
            module.takeScreenshot()

            expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 0.92)
        })

        test('should use custom type and quality', () => {
            canvas = createMockCanvas()

            const module = createRecorderModule()
            module.takeScreenshot({ type: 'image/jpeg', quality: 0.5 })

            expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.5)
        })
    })

    describe('stopCapture', () => {
        test('should stop tracks and close peer connection', async () => {
            const stopFn = vi.fn()
            canvas = createMockCanvas()
            canvas.captureStream = vi.fn().mockReturnValue({
                getTracks: () => [{ stop: stopFn }],
            })
            const mockPc = createMockRTCPeerConnection()

            const module = createRecorderModule()
            await module.startCapture()
            module.stopCapture()

            expect(stopFn).toHaveBeenCalled()
            expect(mockPc.close).toHaveBeenCalled()
        })

        test('should not throw when called without startCapture', () => {
            const module = createRecorderModule()
            expect(() => module.stopCapture()).not.toThrow()
        })

        test('should allow startCapture again after stopCapture', async () => {
            canvas = createMockCanvas()
            createMockRTCPeerConnection()
            const onStarted = vi.fn()

            const module = createRecorderModule()
            module.onStarted = onStarted
            await module.startCapture()
            module.stopCapture()
            await module.startCapture()

            expect(onStarted).toHaveBeenCalledTimes(2)
        })
    })
})
