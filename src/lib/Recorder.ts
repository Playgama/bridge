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

const SCREENSHOT_CAPTURE_FPS = 30
const SCREENSHOT_FRAME_TIMEOUT_MS = 1000

export type RecorderPriority = 'very-low' | 'low' | 'medium' | 'high'

export interface RecorderStartOptions {
    fps?: number
    maxBitrate?: number
    minBitrate?: number
    maxFramerate?: number
    scaleResolutionDownBy?: number
    priority?: RecorderPriority
    networkPriority?: RecorderPriority
    scalabilityMode?: string
    contentHint?: string
}

export interface RecorderAvailability {
    available: boolean
    reason: string | null
}

export interface RecorderScreenshotOptions {
    type?: string
    quality?: number
    maxWidth?: number
    maxHeight?: number
}

export interface RecorderScreenshotResult {
    success: boolean
    reason: string | null
    data: string | null
}

export type RecorderOfferCallback = (sdp: string | undefined) => void
export type RecorderIceCandidateCallback = (candidate: RTCIceCandidateInit) => void
export type RecorderStartedCallback = () => void
export type RecorderErrorCallback = (reason: string | null) => void

class Recorder {
    #captureGeneration = 0

    #pc: RTCPeerConnection | null = null

    #pendingIceCandidates: RTCIceCandidateInit[] = []

    #stream: MediaStream | null = null

    #onOffer: RecorderOfferCallback | null = null

    #onIceCandidate: RecorderIceCandidateCallback | null = null

    #onStarted: RecorderStartedCallback | null = null

    #onError: RecorderErrorCallback | null = null

    set onOffer(fn: RecorderOfferCallback) { this.#onOffer = fn }

    set onIceCandidate(fn: RecorderIceCandidateCallback) { this.#onIceCandidate = fn }

    set onStarted(fn: RecorderStartedCallback) { this.#onStarted = fn }

    set onError(fn: RecorderErrorCallback) { this.#onError = fn }

    checkAvailability(): RecorderAvailability {
        if (!this.#isWebRTCSupported()) {
            return { available: false, reason: 'RTCPeerConnection is not supported' }
        }
        if (!this.#isCaptureStreamSupported()) {
            return { available: false, reason: 'captureStream is not supported' }
        }
        if (!this.#getCanvas()) {
            return { available: false, reason: 'Canvas not found' }
        }
        return { available: true, reason: null }
    }

    async startCapture(options: RecorderStartOptions = {}): Promise<void> {
        const { available, reason } = this.checkAvailability()
        if (!available) {
            this.#onError?.(reason)
            return
        }

        const canvas = this.#getCanvas()
        if (!canvas) {
            return
        }

        this.#captureGeneration += 1
        const generation = this.#captureGeneration
        this.#clearCaptureResources()
        const stream = canvas.captureStream(options.fps || 30)
        this.#stream = stream
        let peerConnection: RTCPeerConnection
        try {
            peerConnection = new RTCPeerConnection()
        } catch (error) {
            this.#clearCaptureResources()
            throw error
        }
        this.#pc = peerConnection

        if (options.contentHint) {
            const track = stream.getVideoTracks()[0]
            if (track) track.contentHint = options.contentHint
        }

        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))

        peerConnection.onicecandidate = (e) => {
            if (e.candidate && this.#isCurrentCapture(generation, peerConnection)) {
                this.#onIceCandidate?.(e.candidate.toJSON())
            }
        }

        let offer: RTCSessionDescriptionInit
        try {
            offer = await peerConnection.createOffer()
            if (!this.#isCurrentCapture(generation, peerConnection)) return
            await peerConnection.setLocalDescription(offer)
            if (!this.#isCurrentCapture(generation, peerConnection)) return
        } catch (error) {
            if (!this.#isCurrentCapture(generation, peerConnection)) return
            this.#clearCaptureResources()
            throw error
        }

        this.#applyEncodingParams(peerConnection, options)

        this.#onOffer?.(offer.sdp)
        this.#onStarted?.()
    }

    async handleAnswer({ sdp }: { sdp: string }): Promise<void> {
        const peerConnection = this.#pc
        if (!peerConnection) return

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp }),
        )
        if (peerConnection !== this.#pc) return

        const pendingCandidates = this.#pendingIceCandidates
        this.#pendingIceCandidates = []
        await Promise.all(pendingCandidates.map((candidate) => (
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        )))
    }

    async handleIce(candidate: RTCIceCandidateInit | null): Promise<void> {
        const peerConnection = this.#pc
        if (!peerConnection || !candidate) return

        if (!peerConnection.remoteDescription) {
            this.#pendingIceCandidates.push(candidate)
            return
        }

        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    }

    takeScreenshot(options: RecorderScreenshotOptions = {}): RecorderScreenshotResult {
        const sourceCanvas = this.#getCanvas()
        if (!sourceCanvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        return this.#serializeScreenshot(
            sourceCanvas,
            sourceCanvas.width,
            sourceCanvas.height,
            options,
            sourceCanvas,
        )
    }

    async takeScreenshotFromSurface(
        options: RecorderScreenshotOptions = {},
    ): Promise<RecorderScreenshotResult> {
        const sourceCanvas = this.#getCanvas()
        if (!sourceCanvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
            return { success: false, reason: 'Canvas has no drawable area', data: null }
        }
        if (typeof sourceCanvas.captureStream !== 'function') {
            return this.takeScreenshot(options)
        }

        let stream: MediaStream | null = null
        let video: HTMLVideoElement | null = null
        try {
            stream = sourceCanvas.captureStream(SCREENSHOT_CAPTURE_FPS)
            const track = stream.getVideoTracks()[0]
            if (!track) {
                return { success: false, reason: 'Canvas capture has no video track', data: null }
            }

            video = document.createElement('video')
            video.srcObject = stream
            video.muted = true
            video.playsInline = true
            await this.#waitForVideoFrame(video, track)
            return this.#serializeScreenshot(
                video,
                video.videoWidth,
                video.videoHeight,
                options,
            )
        } catch (error) {
            return {
                success: false,
                reason: error && typeof error === 'object' && 'message' in error
                    ? String(error.message)
                    : 'Screenshot capture failed',
                data: null,
            }
        } finally {
            video?.pause()
            if (video) video.srcObject = null
            stream?.getTracks().forEach((track) => track.stop())
        }
    }

    stopCapture(): void {
        this.#captureGeneration += 1
        this.#clearCaptureResources()
    }

    #clearCaptureResources(): void {
        this.#stream?.getTracks().forEach((t) => t.stop())
        this.#pc?.close()
        this.#pc = null
        this.#pendingIceCandidates = []
        this.#stream = null
    }

    #serializeScreenshot(
        source: CanvasImageSource,
        sourceWidth: number,
        sourceHeight: number,
        {
            type = 'image/png',
            quality = 0.92,
            maxWidth,
            maxHeight,
        }: RecorderScreenshotOptions = {},
        reusableCanvas: HTMLCanvasElement | null = null,
    ): RecorderScreenshotResult {
        if (sourceWidth === 0 || sourceHeight === 0) {
            return { success: false, reason: 'Screenshot source has no drawable area', data: null }
        }

        try {
            const canvas = this.#fitScreenshotSource(
                source,
                sourceWidth,
                sourceHeight,
                maxWidth,
                maxHeight,
                reusableCanvas,
            )
            if (!canvas) {
                return { success: false, reason: 'Canvas context is not available', data: null }
            }
            const normalizedQuality = Number.isFinite(quality)
                ? Math.min(1, Math.max(0, quality))
                : 0.92
            const data = canvas.toDataURL(type, normalizedQuality)
            if (data === 'data:,') {
                return { success: false, reason: 'Canvas produced an empty screenshot', data: null }
            }
            return { success: true, reason: null, data }
        } catch (error) {
            return {
                success: false,
                reason: error && typeof error === 'object' && 'message' in error
                    ? String(error.message)
                    : 'Screenshot capture failed',
                data: null,
            }
        }
    }

    #fitScreenshotSource(
        source: CanvasImageSource,
        sourceWidth: number,
        sourceHeight: number,
        maxWidth: number | undefined,
        maxHeight: number | undefined,
        reusableCanvas: HTMLCanvasElement | null,
    ): HTMLCanvasElement | null {
        const widthLimit = typeof maxWidth === 'number'
            && Number.isFinite(maxWidth) && maxWidth > 0
            ? maxWidth
            : sourceWidth
        const heightLimit = typeof maxHeight === 'number'
            && Number.isFinite(maxHeight) && maxHeight > 0
            ? maxHeight
            : sourceHeight
        const scale = Math.min(
            1,
            widthLimit / sourceWidth,
            heightLimit / sourceHeight,
        )
        if (scale === 1 && reusableCanvas) return reusableCanvas

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(sourceWidth * scale))
        canvas.height = Math.max(1, Math.round(sourceHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) return null
        context.drawImage(source, 0, 0, canvas.width, canvas.height)
        return canvas
    }

    #applyEncodingParams(
        peerConnection: RTCPeerConnection,
        {
            maxBitrate,
            minBitrate,
            maxFramerate,
            scaleResolutionDownBy,
            priority,
            networkPriority,
            scalabilityMode,
        }: RecorderStartOptions,
    ): void {
        peerConnection.getSenders().forEach((sender) => {
            if (sender.track?.kind !== 'video') return
            const params = sender.getParameters()
            if (!params.encodings?.length) {
                params.encodings = [{}]
            }
            if (maxBitrate !== undefined) {
                params.encodings[0].maxBitrate = maxBitrate
            }
            if (minBitrate !== undefined) {
                (params.encodings[0] as RTCRtpEncodingParameters & { minBitrate?: number }).minBitrate = minBitrate
            }
            if (maxFramerate !== undefined) {
                params.encodings[0].maxFramerate = maxFramerate
            }
            if (scaleResolutionDownBy !== undefined) {
                params.encodings[0].scaleResolutionDownBy = scaleResolutionDownBy
            }
            if (priority !== undefined) {
                params.encodings[0].priority = priority
            }
            if (networkPriority !== undefined) {
                params.encodings[0].networkPriority = networkPriority
            }
            if (scalabilityMode !== undefined) {
                const encoding = params.encodings[0] as RTCRtpEncodingParameters & { scalabilityMode?: string }
                encoding.scalabilityMode = scalabilityMode
            }
            sender.setParameters(params)
        })
    }

    #isCurrentCapture(
        generation: number,
        peerConnection: RTCPeerConnection,
    ): boolean {
        return generation === this.#captureGeneration && peerConnection === this.#pc
    }

    #getCanvas(): HTMLCanvasElement | null {
        return document.querySelector('canvas')
    }

    #isWebRTCSupported(): boolean {
        return typeof RTCPeerConnection !== 'undefined'
    }

    #isCaptureStreamSupported(): boolean {
        return typeof HTMLCanvasElement.prototype.captureStream === 'function'
    }

    #waitForVideoFrame(video: HTMLVideoElement, track: MediaStreamTrack): Promise<void> {
        return new Promise((resolve, reject) => {
            const cleanups: Array<() => void> = []
            let frameCallbackId: number | null = null
            let settled = false
            const settle = (complete: () => void): void => {
                if (settled) return
                settled = true
                cleanups.forEach((cleanup) => cleanup())
                complete()
            }
            const onEnded = (): void => settle(
                () => reject(new Error('Canvas capture ended before its first frame')),
            )
            const onLoadedData = (): void => settle(resolve)
            const timeoutId = setTimeout(() => settle(
                () => reject(new Error('Canvas capture produced no video frames')),
            ), SCREENSHOT_FRAME_TIMEOUT_MS)
            cleanups.push(() => clearTimeout(timeoutId))
            track.addEventListener('ended', onEnded, { once: true })
            cleanups.push(() => track.removeEventListener('ended', onEnded))

            if (typeof video.requestVideoFrameCallback === 'function') {
                frameCallbackId = video.requestVideoFrameCallback(() => settle(resolve))
                cleanups.push(() => {
                    if (frameCallbackId !== null
                        && typeof video.cancelVideoFrameCallback === 'function') {
                        video.cancelVideoFrameCallback(frameCallbackId)
                    }
                })
            } else {
                video.addEventListener('loadeddata', onLoadedData, { once: true })
                cleanups.push(() => video.removeEventListener('loadeddata', onLoadedData))
            }

            Promise.resolve(video.play()).then(() => {
                if (typeof video.requestVideoFrameCallback !== 'function'
                    && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    settle(resolve)
                }
            }).catch((error) => settle(() => reject(error)))
        })
    }
}

export default Recorder
