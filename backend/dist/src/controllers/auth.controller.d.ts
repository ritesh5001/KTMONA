import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
/**
 * Auth Controller
 * Handles HTTP layer for authentication endpoints
 * No business logic - delegates to service layer
 */
export declare class AuthController {
    private readonly service;
    private readonly logger;
    constructor(service: AuthService);
    /**
     * POST /v1/auth/register
     * Register a new USER
     */
    registerUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/seller/register
     * Register a new SELLER
     */
    registerSeller: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/admin/register
     * Register a new ADMIN
     */
    registerAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/request-otp
     * Request mobile verification OTP
     */
    requestOtp: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/verify-otp
     * Verify mobile OTP and activate account
     */
    verifyOtp: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/login
     * Login user with email or phone
     */
    login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/refresh
     * Refresh tokens with rotation
     */
    refresh: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/logout
     * Logout current session (requires auth)
     */
    logout: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * GET /v1/auth/sessions
     * List all user sessions (requires auth)
     */
    listSessions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * DELETE /v1/auth/sessions/:sessionId
     * Revoke a specific session (requires auth)
     */
    revokeSession: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/forgot-password
     * Request a password-reset OTP
     */
    forgotPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * POST /v1/auth/reset-password
     * Verify OTP and set a new password
     */
    resetPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map