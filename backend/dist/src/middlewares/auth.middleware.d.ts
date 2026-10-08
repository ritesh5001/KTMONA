import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
/**
 * Auth Middleware
 * Provides JWT verification and role-based access control
 */
/**
 * Authenticate request middleware
 * Verifies JWT access token and attaches user to request
 */
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
/**
 * Optional authenticate middleware
 * Attempts to verify JWT but does not fail if token is missing.
 * Attaches user to request if token is valid, otherwise continues without user.
 */
export declare function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void;
/**
 * Authorize by role middleware factory
 * Creates middleware that checks if user has required role
 */
export declare function authorize(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Require active status middleware
 * Ensures user account is ACTIVE
 */
export declare function requireActiveStatus(req: Request, _res: Response, next: NextFunction): void;
/**
 * Require email verified middleware
 */
export declare function requireEmailVerified(req: Request, _res: Response, next: NextFunction): void;
/**
 * Require phone verified middleware
 */
export declare function requirePhoneVerified(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map