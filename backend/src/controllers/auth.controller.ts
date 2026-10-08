import type { Request, Response, NextFunction } from 'express';
import { AuthService, authService } from '../services/auth.service.js';
import { registerUserSchema, registerSellerSchema, registerAdminSchema, loginSchema, refreshTokenSchema, logoutSchema, requestOtpSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validation.js';
import { ApiError } from '../errors/ApiError.js';
import { ZodError } from 'zod';
import { authLogger } from '../config/logger.js';

/**
 * Auth Controller
 * Handles HTTP layer for authentication endpoints
 * No business logic - delegates to service layer
 */
export class AuthController {
    private readonly logger = authLogger.child({ component: 'auth-controller' });

    constructor(private readonly service: AuthService) { }

    /**
     * POST /v1/auth/register
     * Register a new USER
     */
    registerUser = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // 1. Validate request body with Zod
            const validatedData = registerUserSchema.parse(req.body);
            this.logger.info({ email: validatedData.email, phone: validatedData.phone ? '[present]' : '[missing]' }, 'register_user_request_received');

            // 2. Call service (business logic)
            const result = await this.service.registerUser(validatedData);

            // 3. Return success response
            res.status(201).json(result);
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                this.logger.warn({ errors: error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })) }, 'register_user_validation_failed');
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }

            // Pass other errors to global error handler
            next(error);
        }
    };

    /**
     * POST /v1/seller/register
     * Register a new SELLER
     */
    registerSeller = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // 1. Validate request body with Zod
            const validatedData = registerSellerSchema.parse(req.body);
            this.logger.info({ email: validatedData.email, phone: validatedData.phone ? '[present]' : '[missing]' }, 'register_seller_request_received');

            // 2. Call service (business logic)
            const result = await this.service.registerSeller(validatedData);

            // 3. Return success response
            res.status(201).json(result);
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                this.logger.warn({ errors: error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })) }, 'register_seller_validation_failed');
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }

            // Pass other errors to global error handler
            next(error);
        }
    };

    /**
     * POST /v1/auth/admin/register
     * Register a new ADMIN
     */
    registerAdmin = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = registerAdminSchema.parse(req.body);
            this.logger.info({ email: validatedData.email }, 'register_admin_request_received');
            const result = await this.service.registerAdmin(validatedData);
            res.status(201).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                this.logger.warn({ errors: error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })) }, 'register_admin_validation_failed');
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }

            next(error);
        }
    };

    /**
     * POST /v1/auth/request-otp
     * Request mobile verification OTP
     */
    requestOtp = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = requestOtpSchema.parse(req.body);
            this.logger.info({ phone: validatedData.phone ? '[present]' : '[missing]' }, 'request_otp_request_received');
            const result = await this.service.requestOtp(validatedData);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                this.logger.warn({ errors: error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })) }, 'request_otp_validation_failed');
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };

    /**
     * POST /v1/auth/verify-otp
     * Verify mobile OTP and activate account
     */
    verifyOtp = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = verifyOtpSchema.parse(req.body);
            this.logger.info({ phone: validatedData.phone ? '[present]' : '[missing]', otpLength: validatedData.otp?.length ?? 0 }, 'verify_otp_request_received');
            const userAgent = req.headers['user-agent'];
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const result = await this.service.verifyOtp(validatedData, userAgent, ipAddress);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                this.logger.warn({ errors: error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })) }, 'verify_otp_validation_failed');
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };

    /**
     * POST /v1/auth/login
     * Login user with email or phone
     */
    login = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // 1. Validate request body with Zod
            const validatedData = loginSchema.parse(req.body);

            // 2. Extract request metadata
            const userAgent = req.headers['user-agent'];
            const ipAddress = req.ip ?? req.socket.remoteAddress;

            // 3. Call service (business logic)
            const result = await this.service.login(
                validatedData.identifier,
                validatedData.password,
                userAgent,
                ipAddress
            );

            // 4. Return success response
            res.status(200).json(result);
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }

            // Pass other errors to global error handler
            next(error);
        }
    };

    /**
     * POST /v1/auth/refresh
     * Refresh tokens with rotation
     */
    refresh = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // 1. Validate request body with Zod
            const validatedData = refreshTokenSchema.parse(req.body);

            // 2. Call service (business logic)
            const result = await this.service.refreshTokens(validatedData.refreshToken);

            // 3. Return success response
            res.status(200).json(result);
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }

            // Pass other errors to global error handler
            next(error);
        }
    };

    /**
     * POST /v1/auth/logout
     * Logout current session (requires auth)
     */
    logout = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Get userId from authenticated user
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            // Validate optional refresh token
            const validatedData = logoutSchema.parse(req.body);

            // Call service
            const result = await this.service.logout(req.user.userId, validatedData.refreshToken);

            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };

    /**
     * GET /v1/auth/sessions
     * List all user sessions (requires auth)
     */
    listSessions = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const result = await this.service.listSessions(req.user.userId);

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /v1/auth/sessions/:sessionId
     * Revoke a specific session (requires auth)
     */
    revokeSession = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const sessionId = req.params['sessionId'];
            if (!sessionId || typeof sessionId !== 'string') {
                throw ApiError.badRequest('Session ID is required');
            }

            const result = await this.service.revokeSession(req.user.userId, sessionId);

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /v1/auth/forgot-password
     * Request a password-reset OTP
     */
    forgotPassword = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = forgotPasswordSchema.parse(req.body);
            const result = await this.service.forgotPassword(validatedData.phone);
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };

    /**
     * POST /v1/auth/reset-password
     * Verify OTP and set a new password
     */
    resetPassword = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = resetPasswordSchema.parse(req.body);
            const result = await this.service.resetPassword(
                validatedData.phone,
                validatedData.otp,
                validatedData.newPassword
            );
            res.status(200).json(result);
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const key = err.path.join('.');
                    acc[key] = err.message;
                    return acc;
                }, {} as Record<string, string>);

                next(ApiError.badRequest('Validation failed', details));
                return;
            }
            next(error);
        }
    };
}

// Export singleton instance with default service
export const authController = new AuthController(authService);
