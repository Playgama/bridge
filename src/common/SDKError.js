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

/**
 * Custom error class for Playgama Bridge SDK
 * Extends native Error with additional properties
 */
export class SDKError extends Error {
    /**
     * Creates a new SDKError instance
     * @param {string} code - Error code (use constants)
     * @param {string} [message] - Human-readable error message
     * @param {Object} [metadata={}] - Additional error metadata
     * @throws {TypeError} If constructor is not called with 'new'
     * @throws {Error} If required parameters are missing or invalid
     */
    constructor(code, message, metadata = {}) {
        if (!new.target) {
            throw new TypeError("Constructor must be called with 'new'")
        }

        // Validate required parameters
        if (!code || typeof code !== 'string') {
            throw new Error('SDKError: code parameter is required and must be a string')
        }

        if (metadata && typeof metadata !== 'object') {
            throw new Error('SDKError: metadata parameter must be an object')
        }

        // Set error message
        const finalMessage = message || code
        super(finalMessage)

        this.name = 'SDKError'

        // Store error properties
        this.code = code
        this.metadata = metadata || {}
        this.timestamp = new Date().toISOString()

        // Ensure proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype)
    }

    /**
     * Converts error to JSON representation
     * @returns {Object} JSON representation of the error
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            metadata: this.metadata,
            timestamp: this.timestamp,
            stack: this.stack,
        }
    }

    /**
     * Creates a standardized error response object
     * @returns {Object} Standardized error response
     */
    toResponse() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                metadata: this.metadata,
            },
        }
    }
}
