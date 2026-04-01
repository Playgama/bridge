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

class RecorderModule {
    #pc = null

    #stream = null

    #onOffer = null

    #onIceCandidate = null

    #onStarted = null

    #onError = null

    /** @param {function(string): void} fn - Called with SDP offer string */
    set onOffer(fn) { this.#onOffer = fn }

    /** @param {function(RTCIceCandidateInit): void} fn - Called with ICE candidate JSON */
    set onIceCandidate(fn) { this.#onIceCandidate = fn }

    /** @param {function(): void} fn - Called when capture has started */
    set onStarted(fn) { this.#onStarted = fn }

    /** @param {function(string): void} fn - Called with error message */
    set onError(fn) { this.#onError = fn }

    /**
     * Checks whether WebRTC streaming is available in the current environment.
     * @returns {{ available: boolean, reason: string | null }}
     */
    checkAvailability() {
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

    /**
     * Starts canvas capture and creates a WebRTC offer.
     * @param {Object} [options]
     * @param {number} [options.fps=30] - Capture frame rate passed to captureStream()
     * @param {number} [options.maxBitrate] - Maximum bitrate in bits/s
     * @param {number} [options.minBitrate] - Minimum bitrate in bits/s
     * @param {number} [options.maxFramerate] - Maximum framerate at encoding level
     * @param {number} [options.scaleResolutionDownBy] - Resolution scale-down factor (e.g. 2.0 = half)
     * @param {'very-low'|'low'|'medium'|'high'} [options.priority] - Encoding priority
     * @param {'very-low'|'low'|'medium'|'high'} [options.networkPriority] - Network-level priority
     * @param {string} [options.scalabilityMode] - SVC scalability mode (e.g. "L1T3")
     */
    async startCapture(options = {}) {
        const { available, reason } = this.checkAvailability()
        if (!available) {
            this.#onError?.(reason)
            return
        }

        const canvas = this.#getCanvas()

        this.#stream = canvas.captureStream(options.fps || 30)
        this.#pc = new RTCPeerConnection()

        this.#stream.getTracks().forEach((t) => this.#pc.addTrack(t, this.#stream))

        this.#pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.#onIceCandidate?.(e.candidate.toJSON())
            }
        }

        const offer = await this.#pc.createOffer()
        await this.#pc.setLocalDescription(offer)

        const hasEncodingParams = [
            options.maxBitrate,
            options.minBitrate,
            options.maxFramerate,
            options.scaleResolutionDownBy,
            options.priority,
            options.networkPriority,
            options.scalabilityMode,
        ].some((v) => v !== undefined)
        if (hasEncodingParams) {
            this.#applyEncodingParams(options)
        }

        this.#onOffer?.(offer.sdp)
        this.#onStarted?.()
    }

    /**
     * Sets the remote SDP answer on the peer connection.
     * @param {Object} params
     * @param {string} params.sdp - Remote SDP answer string
     */
    async handleAnswer({ sdp }) {
        if (this.#pc) {
            await this.#pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp }),
            )
        }
    }

    /**
     * Adds a remote ICE candidate to the peer connection.
     * @param {RTCIceCandidateInit | null} candidate
     */
    async handleIce(candidate) {
        if (this.#pc && candidate) {
            await this.#pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
    }

    /**
     * Takes a screenshot of the current canvas.
     * @param {Object} [options]
     * @param {string} [options.type='image/png'] - Image MIME type
     * @param {number} [options.quality=0.92] - Image quality (0–1)
     * @returns {{ success: boolean, reason: string | null, data: string | null }}
     */
    takeScreenshot({ type = 'image/png', quality = 0.92 } = {}) {
        const canvas = this.#getCanvas()
        if (!canvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        const data = canvas.toDataURL(type, quality)
        return { success: true, reason: null, data }
    }

    /** Stops the capture, closes the peer connection and releases all tracks. */
    stopCapture() {
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
    }) {
        this.#pc.getSenders().forEach((sender) => {
            if (sender.track?.kind !== 'video') return
            const params = sender.getParameters()
            if (!params.encodings?.length) {
                params.encodings = [{}]
            }
            if (maxBitrate !== undefined) params.encodings[0].maxBitrate = maxBitrate
            if (minBitrate !== undefined) params.encodings[0].minBitrate = minBitrate
            if (maxFramerate !== undefined) params.encodings[0].maxFramerate = maxFramerate
            if (scaleResolutionDownBy !== undefined) params.encodings[0].scaleResolutionDownBy = scaleResolutionDownBy
            if (priority !== undefined) params.encodings[0].priority = priority
            if (networkPriority !== undefined) params.encodings[0].networkPriority = networkPriority
            if (scalabilityMode !== undefined) params.encodings[0].scalabilityMode = scalabilityMode
            sender.setParameters(params)
        })
    }

    #getCanvas() {
        return document.querySelector('canvas')
    }

    #isWebRTCSupported() {
        return typeof RTCPeerConnection !== 'undefined'
    }

    #isCaptureStreamSupported() {
        return typeof HTMLCanvasElement.prototype.captureStream === 'function'
    }
}

export { RecorderModule }
export default new RecorderModule()
