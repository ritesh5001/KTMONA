/**
 * Custom API Error class for handling operational errors
 * Extends native Error with additional properties for HTTP responses
 */
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly details: Record<string, unknown> | undefined;
    constructor(statusCode: number, message: string, details?: Record<string, unknown>, isOperational?: boolean);
    /**
     * Factory method for 400 Bad Request errors
     */
    static badRequest(message: string, details?: Record<string, unknown>): ApiError;
    /**
     * Factory method for 401 Unauthorized errors
     */
    static unauthorized(message?: string): ApiError;
    /**
     * Factory method for 403 Forbidden errors
     */
    static forbidden(message?: string, details?: Record<string, unknown>): ApiError;
    /**
     * Factory method for 404 Not Found errors
     */
    static notFound(message?: string): ApiError;
    /**
     * Factory method for 409 Conflict errors
     */
    static conflict(message: string, details?: Record<string, unknown>): ApiError;
    /**
     * Factory method for 422 Unprocessable Entity errors
     */
    static unprocessableEntity(message: string, details?: Record<string, unknown>): ApiError;
    /**
     * Factory method for 500 Internal Server errors
     */
    static internal(message?: string): ApiError;
}
//# sourceMappingURL=ApiError.d.ts.map