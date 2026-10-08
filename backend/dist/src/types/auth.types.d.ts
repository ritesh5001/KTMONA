import type { Role, UserStatus } from '@prisma/client';
/**
 * User entity as returned from database
 */
export interface UserEntity {
    id: string;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    passwordHash: string;
    role: Role;
    status: UserStatus;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * User without sensitive data (for responses)
 */
export interface SafeUser {
    id: string;
    email: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    role: Role;
    status: UserStatus;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Login session entity
 */
export interface LoginSessionEntity {
    id: string;
    userId: string;
    refreshToken: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * User registration request (USER role via /v1/auth/register)
 */
export interface RegisterUserRequest {
    fullName: string;
    email: string;
    phone: string;
    password: string;
}
/**
 * Seller registration request (SELLER role via /v1/seller/register)
 * Note: Seller profile managed by SELLER microservice
 */
export interface RegisterSellerRequest {
    email: string;
    phone: string;
    whatsappNumber: string;
    password: string;
}
/**
 * Admin registration request (ADMIN role via /v1/auth/admin/register)
 */
export interface RegisterAdminRequest {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string | undefined;
    department?: string | undefined;
    designation?: string | undefined;
}
/**
 * Admin creation request (internal API only)
 */
export interface CreateAdminRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    department?: string;
    designation?: string;
}
/**
 * QA Admin creation request (internal API only)
 */
export interface CreateQaAdminRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    specialization?: string;
}
/**
 * Login request payload
 */
export interface LoginRequest {
    email: string;
    password: string;
}
/**
 * Refresh token request payload
 */
export interface RefreshTokenRequest {
    refreshToken: string;
}
/**
 * Authentication response with tokens
 */
export interface AuthResponse {
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
}
/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
    accessToken: string;
    refreshToken: string;
}
/**
 * Registration success response
 */
export interface RegisterSuccessResponse {
    message: string;
}
/**
 * Login response with user and tokens
 */
export interface LoginResponse {
    user: {
        id: string;
        email: string | null;
        phone: string | null;
        role: string;
        status: string;
        isEmailVerified: boolean;
        isPhoneVerified: boolean;
    };
    accessToken: string;
    refreshToken: string;
}
/**
 * Session creation data
 */
export interface CreateSessionData {
    userId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
}
/**
 * Data for creating a new user in database
 */
export interface CreateUserData {
    /** Null for phone-only signups; schema allows it. */
    email: string | null;
    phone: string;
    whatsappNumber?: string | null;
    passwordHash: string;
    role: Role;
    status: UserStatus;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
}
/**
 * Session info for listing user sessions
 */
export interface SessionInfo {
    sessionId: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * List sessions response
 */
export interface ListSessionsResponse {
    sessions: SessionInfo[];
}
/**
 * Generic message response
 */
export interface MessageResponse {
    message: string;
}
export declare const _authTypesModule = true;
//# sourceMappingURL=auth.types.d.ts.map