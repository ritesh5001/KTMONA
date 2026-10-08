/**
 * Custom API Error class for handling operational errors
 * Extends native Error with additional properties for HTTP responses
 */
export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly details: Record<string, unknown> | undefined;

    constructor(
        statusCode: number,
        message: string,
        details?: Record<string, unknown>,
        isOperational = true
    ) {
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
    static badRequest(message: string, details?: Record<string, unknown>): ApiError {
        return new ApiError(400, message, details);
    }

    /**
     * Factory method for 401 Unauthorized errors
     */
    static unauthorized(message = 'Unauthorized'): ApiError {
        return new ApiError(401, message);
    }

    /**
     * Factory method for 403 Forbidden errors
     */
    static forbidden(message = 'Forbidden', details?: Record<string, unknown>): ApiError {
        return new ApiError(403, message, details);
    }

    /**
     * Factory method for 404 Not Found errors
     */
    static notFound(message = 'Resource not found'): ApiError {
        return new ApiError(404, message);
    }

    /**
     * Factory method for 409 Conflict errors
     */
    static conflict(message: string, details?: Record<string, unknown>): ApiError {
        return new ApiError(409, message, details);
    }

    /**
     * Factory method for 422 Unprocessable Entity errors
     */
    static unprocessableEntity(message: string, details?: Record<string, unknown>): ApiError {
        return new ApiError(422, message, details);
    }

    /**
     * Factory method for 500 Internal Server errors
     */
    static internal(message = 'Internal server error'): ApiError {
        return new ApiError(500, message, undefined, false);
    }
}
