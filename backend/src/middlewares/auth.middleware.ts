import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractBearerToken } from '../utils/jwt.util.js';
import { ApiError } from '../errors/ApiError.js';
import type { Role } from '@prisma/client';

/**
 * Auth Middleware
 * Provides JWT verification and role-based access control
 */

/**
 * Authenticate request middleware
 * Verifies JWT access token and attaches user to request
 */
export function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        // 1. Extract token from Authorization header
        const token = extractBearerToken(req.headers.authorization);
        if (!token) {
            throw ApiError.unauthorized('Access token required');
        }

        // 2. Verify token (throws if invalid/expired)
        const decoded = verifyAccessToken(token);

        // 3. Attach user payload to request
        req.user = decoded;

        // 4. Call next()
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Optional authenticate middleware
 * Attempts to verify JWT but does not fail if token is missing.
 * Attaches user to request if token is valid, otherwise continues without user.
 */
export function optionalAuthenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        const token = extractBearerToken(req.headers.authorization);
        if (token) {
            const decoded = verifyAccessToken(token);
            req.user = decoded;
        }
        next();
    } catch {
        // Invalid token — continue without user
        next();
    }
}

/**
 * Authorize by role middleware factory
 * Creates middleware that checks if user has required role
 */
export function authorize(...roles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            // 1. Ensure user is authenticated
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            // 2. Check if user role is in allowed roles
            if (!roles.includes(req.user.role)) {
                throw ApiError.forbidden('Insufficient permissions');
            }

            // 3. Call next()
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Require active status middleware
 * Ensures user account is ACTIVE
 */
export function requireActiveStatus(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        // 1. Ensure user is authenticated
        if (!req.user) {
            throw ApiError.unauthorized('Authentication required');
        }

        // 2. Check if user status is ACTIVE
        if (req.user.status !== 'ACTIVE') {
            throw ApiError.forbidden('Account not active');
        }

        // 3. Call next()
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Require email verified middleware
 */
export function requireEmailVerified(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        if (!req.user) {
            throw ApiError.unauthorized('Authentication required');
        }

        if (!req.user.isEmailVerified) {
            throw ApiError.forbidden('Email verification required');
        }

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Require phone verified middleware
 */
export function requirePhoneVerified(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    try {
        if (!req.user) {
            throw ApiError.unauthorized('Authentication required');
        }

        if (!req.user.isPhoneVerified) {
            throw ApiError.forbidden('Phone verification required');
        }

        next();
    } catch (error) {
        next(error);
    }
}
