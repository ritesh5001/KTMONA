import type { Request, Response, NextFunction } from 'express';
/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
export declare function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction): void;
/**
 * Async handler wrapper to catch errors in async route handlers
 * Eliminates the need for try-catch in every controller
 */
export declare function asyncHandler<T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error.middleware.d.ts.map