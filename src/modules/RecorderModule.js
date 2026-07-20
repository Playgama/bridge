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
    #captureGeneration = 0

    #pc = null

    #pendingIceCandidates = []

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
     * @param {string} [options.contentHint='detail'] - Track content hint ('detail', 'motion', 'text')
     */
    async startCapture(options = {}) {
        const { available, reason } = this.checkAvailability()
        if (!available) {
            this.#onError?.(reason)
            return
        }

        const canvas = this.#getCanvas()

        this.#captureGeneration += 1
        const generation = this.#captureGeneration
        this.#clearCaptureResources()
        const stream = canvas.captureStream(options.fps || 30)
        this.#stream = stream
        let peerConnection
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

        let offer
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

    /**
     * Sets the remote SDP answer on the peer connection.
     * @param {Object} params
     * @param {string} params.sdp - Remote SDP answer string
     */
    async handleAnswer({ sdp }) {
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

    /**
     * Adds a remote ICE candidate to the peer connection.
     * @param {RTCIceCandidateInit | null} candidate
     */
    async handleIce(candidate) {
        const peerConnection = this.#pc
        if (!peerConnection || !candidate) return

        if (!peerConnection.remoteDescription) {
            this.#pendingIceCandidates.push(candidate)
            return
        }

        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    }

    /**
     * Takes a screenshot of the current canvas.
     * @param {Object} [options]
     * @param {string} [options.type='image/png'] - Image MIME type
     * @param {number} [options.quality=0.92] - Image quality (0–1)
     * @param {number} [options.maxWidth] - Maximum screenshot width
     * @param {number} [options.maxHeight] - Maximum screenshot height
     * @returns {{ success: boolean, reason: string | null, data: string | null }}
     */
    takeScreenshot({
        type = 'image/png',
        quality = 0.92,
        maxWidth,
        maxHeight,
    } = {}) {
        const sourceCanvas = this.#getCanvas()
        if (!sourceCanvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
            return { success: false, reason: 'Canvas has no drawable area', data: null }
        }

        try {
            const canvas = this.#fitScreenshotCanvas(sourceCanvas, maxWidth, maxHeight)
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

    /**
     * Waits for the next paint before taking a screenshot.
     * @param {Object} [options] - Screenshot options passed to takeScreenshot()
     * @returns {Promise<{ success: boolean, reason: string | null, data: string | null }>}
     */
    async takeScreenshotAfterPaint(options = {}) {
        await this.#waitForPaint()
        return this.takeScreenshot(options)
    }

    /** Stops the capture, closes the peer connection and releases all tracks. */
    stopCapture() {
        this.#captureGeneration += 1
        this.#clearCaptureResources()
    }

    #clearCaptureResources() {
        this.#stream?.getTracks().forEach((t) => t.stop())
        this.#pc?.close()
        this.#pc = null
        this.#pendingIceCandidates = []
        this.#stream = null
    }

    #fitScreenshotCanvas(sourceCanvas, maxWidth, maxHeight) {
        const widthLimit = typeof maxWidth === 'number'
            && Number.isFinite(maxWidth) && maxWidth > 0
            ? maxWidth
            : sourceCanvas.width
        const heightLimit = typeof maxHeight === 'number'
            && Number.isFinite(maxHeight) && maxHeight > 0
            ? maxHeight
            : sourceCanvas.height
        const scale = Math.min(
            1,
            widthLimit / sourceCanvas.width,
            heightLimit / sourceCanvas.height,
        )
        if (scale === 1) return sourceCanvas

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale))
        canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale))
        const context = canvas.getContext('2d')
        if (!context) return null
        context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)
        return canvas
    }

    #applyEncodingParams(peerConnection, {
        maxBitrate,
        minBitrate,
        maxFramerate,
        scaleResolutionDownBy,
        priority,
        networkPriority,
        scalabilityMode,
    }) {
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
                params.encodings[0].minBitrate = minBitrate
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
                params.encodings[0].scalabilityMode = scalabilityMode
            }
            sender.setParameters(params)
        })
    }

    #isCurrentCapture(generation, peerConnection) {
        return generation === this.#captureGeneration && peerConnection === this.#pc
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

    #waitForPaint() {
        if (typeof requestAnimationFrame !== 'function') return Promise.resolve()

        return new Promise((resolve) => {
            let completed = false
            let frameId = 0
            let timeoutId
            const finish = () => {
                if (completed) return
                completed = true
                clearTimeout(timeoutId)
                if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId)
                resolve()
            }
            timeoutId = setTimeout(finish, 100)
            frameId = requestAnimationFrame(finish)
        })
    }
}

export { RecorderModule }
export default new RecorderModule()
