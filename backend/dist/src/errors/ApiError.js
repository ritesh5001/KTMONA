/**
 * Custom API Error class for handling operational errors
 * Extends native Error with additional properties for HTTP responses
 */
export class ApiError extends Error {
    statusCode;
    isOperational;
    details;
    constructor(statusCode, message, details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
        // Set the prototype explicitly for instanceof checks
        Object.setPrototypeOf(this, ApiError.prototype);
    }
    /**
     * Factory method for 400 Bad Request errors
     */
    static badRequest(message, details) {
        return new ApiError(400, message, details);
    }
    /**
     * Factory method for 401 Unauthorized errors
     */
    static unauthorized(message = 'Unauthorized') {
        return new ApiError(401, message);
    }
    /**
     * Factory method for 403 Forbidden errors
     */
    static forbidden(message = 'Forbidden', details) {
        return new ApiError(403, message, details);
    }
    /**
     * Factory method for 404 Not Found errors
     */
    static notFound(message = 'Resource not found') {
        return new ApiError(404, message);
    }
    /**
     * Factory method for 409 Conflict errors
     */
    static conflict(message, details) {
        return new ApiError(409, message, details);
    }
    /**
     * Factory method for 422 Unprocessable Entity errors
     */
    static unprocessableEntity(message, details) {
        return new ApiError(422, message, details);
    }
    /**
     * Factory method for 500 Internal Server errors
     */
    static internal(message = 'Internal server error') {
        return new ApiError(500, message, undefined, false);
    }
}
//# sourceMappingURL=ApiError.js.map