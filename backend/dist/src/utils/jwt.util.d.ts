import { type JwtPayload } from 'jsonwebtoken';
import { Role, UserStatus } from '@prisma/client';
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
export declare function generateAccessToken(payload: AccessTokenPayload): string;
/**
 * Generate a refresh token with session information
 * @param payload - Session data to encode in the token
 * @returns Signed JWT refresh token
 */
export declare function generateRefreshToken(payload: RefreshTokenPayload): string;
/**
 * Generate both access and refresh tokens
 * @param accessPayload - User data for access token
 * @param refreshPayload - Session data for refresh token
 * @returns Token pair with both tokens
 */
export declare function generateTokenPair(accessPayload: AccessTokenPayload, refreshPayload: RefreshTokenPayload): TokenPair;
/**
 * Verify and decode an access token
 * @param token - JWT access token to verify
 * @returns Decoded token payload
 * @throws ApiError if token is invalid or expired
 */
export declare function verifyAccessToken(token: string): DecodedAccessToken;
/**
 * Verify and decode a refresh token
 * @param token - JWT refresh token to verify
 * @returns Decoded token payload
 * @throws ApiError if token is invalid or expired
 */
export declare function verifyRefreshToken(token: string): DecodedRefreshToken;
/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value (Bearer token)
 * @returns Token string or null if not found
 */
export declare function extractBearerToken(authHeader: string | undefined): string | null;
//# sourceMappingURL=jwt.util.d.ts.map