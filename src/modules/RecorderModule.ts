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

class RecorderModule {
    #pc: RTCPeerConnection | null = null

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

        this.#stream = canvas.captureStream(options.fps || 30)

        if (options.contentHint) {
            const track = this.#stream.getVideoTracks()[0]
            if (track) track.contentHint = options.contentHint
        }

        this.#pc = new RTCPeerConnection()

        this.#stream.getTracks().forEach((t) => this.#pc!.addTrack(t, this.#stream!))

        this.#pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.#onIceCandidate?.(e.candidate.toJSON())
            }
        }

        const offer = await this.#pc.createOffer()
        await this.#pc.setLocalDescription(offer)

        this.#applyEncodingParams(options)

        this.#onOffer?.(offer.sdp)
        this.#onStarted?.()
    }

    async handleAnswer({ sdp }: { sdp: string }): Promise<void> {
        if (this.#pc) {
            await this.#pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp }),
            )
        }
    }

    async handleIce(candidate: RTCIceCandidateInit | null): Promise<void> {
        if (this.#pc && candidate) {
            await this.#pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
    }

    takeScreenshot({ type = 'image/png', quality = 0.92 }: RecorderScreenshotOptions = {}): RecorderScreenshotResult {
        const canvas = this.#getCanvas()
        if (!canvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        const data = canvas.toDataURL(type, quality)
        return { success: true, reason: null, data }
    }

    stopCapture(): void {
        this.#stream?.getTracks().forEach((t) => t.stop())
        this.#pc?.close()
        this.#pc = null
        this.#stream = null
    }

    #applyEncodingParams({
        maxBitrate,
        minBitrate,
        maxFramerate,
        scaleResolutionDownBy,
        priority,
        networkPriority,
        scalabilityMode,
    }: RecorderStartOptions): void {
        this.#pc?.getSenders().forEach((sender) => {
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
                (params.encodings[0] as RTCRtpEncodingParameters & { scalabilityMode?: string }).scalabilityMode = scalabilityMode
            }
            sender.setParameters(params)
        })
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
}

export { RecorderModule }
export default new RecorderModule()
