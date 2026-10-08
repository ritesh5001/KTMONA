import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';
/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
export function errorMiddleware(err, _req, res, _next) {
    // Log error for debugging (in production, use proper logging)
    console.error('[Error]:', err);
    const prismaError = err;
    const bodyParserError = err;
    if (bodyParserError.type === 'entity.too.large' || bodyParserError.status === 413) {
        const response = {
            success: false,
            error: {
                message: 'Request payload is too large',
                statusCode: 413,
                details: {
                    type: bodyParserError.type,
                    limit: bodyParserError.limit,
                    length: bodyParserError.length,
                },
            },
        };
        res.status(413).json(response);
        return;
    }
    if (prismaError.code === 'P1001') {
        const response = {
            success: false,
            error: {
                message: 'Database temporarily unavailable',
                statusCode: 503,
                ...(prismaError.meta && { details: prismaError.meta }),
            },
        };
        res.status(503).json(response);
        return;
    }
    // Controllers that call `schema.parse()` inline hand the raw ZodError to
    // next(). Without this it fell through to the 500 branch and every rejected
    // field read as "Internal server error" to the client.
    if (err instanceof ZodError) {
        const response = {
            success: false,
            error: {
                message: err.errors
                    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
                    .join(', '),
                statusCode: 400,
            },
        };
        res.status(400).json(response);
        return;
    }
    // Handle ApiError (operational errors)
    if (err instanceof ApiError) {
        const response = {
            success: false,
            error: {
                message: err.message,
                statusCode: err.statusCode,
                ...(err.details && { details: err.details }),
            },
        };
        res.status(err.statusCode).json(response);
        return;
    }
    // Handle unexpected errors (programming errors)
    const response = {
        success: false,
        error: {
            message: process.env['NODE_ENV'] === 'production'
                ? 'Internal server error'
                : err.message,
            statusCode: 500,
        },
    };
    res.status(500).json(response);
}
/**
 * Async handler wrapper to catch errors in async route handlers
 * Eliminates the need for try-catch in every controller
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=error.middleware.js.map