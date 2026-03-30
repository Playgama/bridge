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

    set onOffer(fn) { this.#onOffer = fn }

    set onIceCandidate(fn) { this.#onIceCandidate = fn }

    set onStarted(fn) { this.#onStarted = fn }

    set onError(fn) { this.#onError = fn }

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

    async startCapture({ fps = 30 } = {}) {
        const { available, reason } = this.checkAvailability()
        if (!available) {
            this.#onError?.(reason)
            return
        }

        const canvas = this.#getCanvas()

        this.#stream = canvas.captureStream(fps)
        this.#pc = new RTCPeerConnection()

        this.#stream.getTracks().forEach((t) => this.#pc.addTrack(t, this.#stream))

        this.#pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.#onIceCandidate?.(e.candidate.toJSON())
            }
        }

        const offer = await this.#pc.createOffer()
        await this.#pc.setLocalDescription(offer)
        this.#onOffer?.(offer.sdp)
        this.#onStarted?.()
    }

    async handleAnswer({ sdp }) {
        if (this.#pc) {
            await this.#pc.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp }),
            )
        }
    }

    async handleIce(candidate) {
        if (this.#pc && candidate) {
            await this.#pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
    }

    takeScreenshot({ type = 'image/png', quality = 0.92 } = {}) {
        const canvas = this.#getCanvas()
        if (!canvas) {
            return { success: false, reason: 'Canvas not found', data: null }
        }
        const data = canvas.toDataURL(type, quality)
        return { success: true, reason: null, data }
    }

    stopCapture() {
        this.#stream?.getTracks().forEach((t) => t.stop())
        this.#pc?.close()
        this.#pc = null
        this.#stream = null
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
