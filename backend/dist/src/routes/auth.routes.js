import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
/**
 * Auth Routes
 * Base path: /v1/auth
 */
const authRouter = Router();
// ============================================================================
// PUBLIC ROUTES
// ============================================================================
/**
 * POST /v1/auth/register
 * Register a new USER
 */
authRouter.post('/register', authController.registerUser);
/**
 * POST /v1/auth/admin/register
 * Register a new ADMIN
 */
authRouter.post('/admin/register', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), authController.registerAdmin);
/**
 * POST /v1/auth/login
 * Login with email or phone
 */
authRouter.post('/login', authController.login);
/**
 * POST /v1/auth/request-otp
 * Request mobile verification OTP
 */
authRouter.post('/request-otp', authController.requestOtp);
/**
 * POST /v1/auth/verify-otp
 * Verify mobile OTP
 */
authRouter.post('/verify-otp', authController.verifyOtp);
/**
 * POST /v1/auth/refresh
 * Refresh tokens with rotation
 */
authRouter.post('/refresh', authController.refresh);
/**
 * POST /v1/auth/forgot-password
 * Request a password-reset OTP
 */
authRouter.post('/forgot-password', authController.forgotPassword);
/**
 * POST /v1/auth/reset-password
 * Verify OTP and set a new password
 */
authRouter.post('/reset-password', authController.resetPassword);
// ============================================================================
// PROTECTED ROUTES (require valid access token)
// ============================================================================
/**
 * POST /v1/auth/logout
 * Logout current session
 */
authRouter.post('/logout', authenticate, authController.logout);
/**
 * GET /v1/auth/sessions
 * List all user sessions
 */
authRouter.get('/sessions', authenticate, authController.listSessions);
/**
 * DELETE /v1/auth/sessions/:sessionId
 * Revoke a specific session
 */
authRouter.delete('/sessions/:sessionId', authenticate, authController.revokeSession);
export { authRouter };
//# sourceMappingURL=auth.routes.js.map