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

export type RecorderOfferCallback = (sdp: string | undefined) => void
export type RecorderIceCandidateCallback = (candidate: RTCIceCandidateInit) => void
export type RecorderStartedCallback = () => void
export type RecorderErrorCallback = (reason: string | null) => void

class Recorder {
    #captureGeneration = 0

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

    stopCapture(): void {
        this.#captureGeneration += 1
        this.#clearCaptureResources()
    }

    #clearCaptureResources(): void {
        this.#stream?.getTracks().forEach((t) => t.stop())
        this.#pc?.close()
        this.#pc = null
        this.#stream = null
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
}

export default Recorder
