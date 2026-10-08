import type { StringValue } from 'ms';
import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { Role, UserStatus } from '@prisma/client';

// Re-export Prisma enums for use throughout the app
export { Role, UserStatus };

/**
 * Access token payload structure
 */
export interface AccessTokenPayload {
    userId: string;
    email: string | null;
    phone: string | null;
    role: Role;
    status: UserStatus;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
}

/**
 * Refresh token payload structure
 */
export interface RefreshTokenPayload {
    userId: string;
    sessionId: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
}

/**
 * Decoded access token including JWT standard claims
 */
export interface DecodedAccessToken extends AccessTokenPayload, JwtPayload {
    iat: number;
    exp: number;
}

/**
 * Decoded refresh token including JWT standard claims
 */
export interface DecodedRefreshToken extends RefreshTokenPayload, JwtPayload {
    iat: number;
    exp: number;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

/**
 * Generate an access token with user information
 * @param payload - User data to encode in the token
 * @returns Signed JWT access token
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
        expiresIn: env.ACCESS_TOKEN_EXPIRY as StringValue,
        algorithm: 'HS256',
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Generate a refresh token with session information
 * @param payload - Session data to encode in the token
 * @returns Signed JWT refresh token
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
        expiresIn: env.REFRESH_TOKEN_EXPIRY as StringValue,
        algorithm: 'HS256',
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

/**
 * Generate both access and refresh tokens
 * @param accessPayload - User data for access token
 * @param refreshPayload - Session data for refresh token
 * @returns Token pair with both tokens
 */
export function generateTokenPair(
    accessPayload: AccessTokenPayload,
    refreshPayload: RefreshTokenPayload
): TokenPair {
    return {
        accessToken: generateAccessToken(accessPayload),
        refreshToken: generateRefreshToken(refreshPayload),
    };
}

/**
 * Verify and decode an access token
 * @param token - JWT access token to verify
 * @returns Decoded token payload
 * @throws ApiError if token is invalid or expired
 */
export function verifyAccessToken(token: string): DecodedAccessToken {
    try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedAccessToken;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw ApiError.unauthorized('Access token has expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw ApiError.unauthorized('Invalid access token');
        }
        throw ApiError.unauthorized('Token verification failed');
    }
}

/**
 * Verify and decode a refresh token
 * @param token - JWT refresh token to verify
 * @returns Decoded token payload
 * @throws ApiError if token is invalid or expired
 */
export function verifyRefreshToken(token: string): DecodedRefreshToken {
    try {
        const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as DecodedRefreshToken;
        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw ApiError.unauthorized('Refresh token has expired');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw ApiError.unauthorized('Invalid refresh token');
        }
        throw ApiError.unauthorized('Token verification failed');
    }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value (Bearer token)
 * @returns Token string or null if not found
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}
