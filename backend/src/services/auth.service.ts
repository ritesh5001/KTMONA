import { AuthRepository, authRepository } from '../repositories/auth.repository.js';
import type {
    RegisterUserRequest,
    RegisterSellerRequest,
    RegisterAdminRequest,
    RegisterSuccessResponse,
    LoginResponse,
    TokenRefreshResponse,
    ListSessionsResponse,
    MessageResponse,
} from '@/types/auth.types.js';
import { hashPassword, comparePassword, hashToken, compareToken } from '../utils/password.util.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util.js';
import { ApiError } from '../errors/ApiError.js';
import { env } from '../config/env.js';
import type { StringValue } from 'ms';
import ms from 'ms';
import { otpService, type SignupOtpPayload } from './otp.service.js';
import { hashOtp } from '../utils/otp.util.js';
import { otpRepository } from '../repositories/otp.repository.js';
import { normalizeIndianMobile } from '../utils/phone.util.js';
import { OtpPurpose } from '@prisma/client';
import type { Role, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { authLogger } from '../config/logger.js';
import { sellerSuspensionService } from './seller-suspension.service.js';


/**
 * Auth Service
 * Contains all business logic for authentication
 * Testable and independent of HTTP layer
 */
/**
 * Refresh-token lifetime for a role. Buyers and sellers stay signed in until
 * they log out (long, sliding sessions); staff accounts keep the short one.
 */
function refreshExpiryFor(role: Role): string {
    return role === 'USER' || role === 'SELLER'
        ? env.PERSISTENT_REFRESH_TOKEN_EXPIRY
        : env.REFRESH_TOKEN_EXPIRY;
}

export class AuthService {
    constructor(private readonly repository: AuthRepository) { }
    private readonly logger = authLogger.child({ component: 'auth-service' });

    private async issueTokens(
        user: {
        id: string;
        email: string | null;
        phone: string | null;
        role: Role;
        status: UserStatus;
        isEmailVerified: boolean;
        isPhoneVerified: boolean;
        },
        userAgent?: string,
        ipAddress?: string
    ): Promise<LoginResponse> {
        const sessionId = randomUUID();

        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        });

        const refreshExpiry = refreshExpiryFor(user.role);
        const refreshToken = generateRefreshToken({
            userId: user.id,
            sessionId,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        }, refreshExpiry);

        const refreshTokenExpiryMs = ms(refreshExpiry as StringValue);
        const expiresAt = new Date(Date.now() + refreshTokenExpiryMs);
        const hashedRefreshToken = await hashToken(refreshToken);

        await this.repository.createSession({
            sessionId,
            userId: user.id,
            refreshToken: hashedRefreshToken,
            userAgent: userAgent ?? undefined,
            ipAddress: ipAddress ?? undefined,
            expiresAt,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                status: user.status,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
            },
            accessToken,
            refreshToken,
        };
    }

    /**
     * Register a new USER
     * POST /v1/auth/register
     * 
     * Business Rules:
     * 1. Check if email OR phone already exists
     * 2. Hash password
     * 3. Create user with role=USER, status=ACTIVE
     * 4. No JWT generation, no auto-login
     */
    async registerUser(data: RegisterUserRequest): Promise<RegisterSuccessResponse> {
        // Customers sign up with an email address OR a mobile number.
        const phone = data.phone ? normalizeIndianMobile(data.phone) : null;
        const email = data.email?.trim().toLowerCase() || null;
        this.logger.info({ email, phone: phone ? '[present]' : '[missing]', role: 'USER' }, 'register_user_started');
        // 1. Check if email or phone already exists
        const exists = await this.repository.existsByEmailOrPhone(email, phone);
        if (exists) {
            this.logger.warn({ email: data.email, phone }, 'register_user_conflict');
            throw ApiError.conflict('Email or phone already in use');
        }

        // 2. Hash password
        const passwordHash = await hashPassword(data.password);

        // 3. Send OTP for signup (account will be created after verification)
        const payload: SignupOtpPayload = {
            email,
            phone,
            passwordHash,
            role: 'USER',
            fullName: data.fullName,
        };
        const channel = await otpService.sendSignupOtp(payload);
        this.logger.info({ email, phone: phone ? '[present]' : '[missing]', channel, role: 'USER' }, 'register_user_otp_sent');

        // 4. Return success message (no token, no auto-login)
        return {
            message: channel === 'email' ? 'OTP sent to your email address' : 'OTP sent to your mobile number',
        };
    }

    /**
     * Register a new SELLER
     * POST /v1/seller/register
     * 
     * Business Rules:
     * 1. Check if email OR phone already exists
     * 2. Hash password
     * 3. Create user with role=SELLER, status=PENDING
     * 4. No JWT generation, no auto-login
     * 5. Seller cannot login until approved
     */
    async registerSeller(data: RegisterSellerRequest): Promise<RegisterSuccessResponse> {
        const phone = normalizeIndianMobile(data.phone);
        const whatsappNumber = normalizeIndianMobile(data.whatsappNumber);
        this.logger.info({ email: data.email, phone: phone ? '[present]' : '[missing]', whatsappNumber: whatsappNumber ? '[present]' : '[missing]', role: 'SELLER' }, 'register_seller_started');
        // 1. Check if email or phone already exists
        const exists = await this.repository.existsByEmailOrPhone(data.email, phone);
        if (exists) {
            this.logger.warn({ email: data.email, phone }, 'register_seller_conflict');
            throw ApiError.conflict('Email or phone already in use');
        }

        // 2. Hash password
        const passwordHash = await hashPassword(data.password);

        // 3. Send OTP for signup (account will be created after verification)
        const payload: SignupOtpPayload = {
            email: data.email,
            phone,
            whatsappNumber,
            passwordHash,
            role: 'SELLER',
        };
        await otpService.sendSignupOtp(payload);
        this.logger.info({ email: data.email, phone: '[present]', whatsappNumber: '[present]', role: 'SELLER' }, 'register_seller_otp_sent');

        // 4. Return success message (no token, pending approval)
        return {
            message: 'OTP sent to your mobile number. Verify to complete seller registration.',
        };
    }

    /**
     * Register a new ADMIN
     * POST /v1/auth/admin/register
     * 
     * Business Rules:
     * 1. Check if email OR phone already exists
     * 2. Hash password
     * 3. Create user with role=ADMIN, status=ACTIVE
     */
    async registerAdmin(data: RegisterAdminRequest): Promise<RegisterSuccessResponse> {
        const phone = data.phone ?? '';

        if (phone) {
            const exists = await this.repository.existsByEmailOrPhone(data.email, phone);
            if (exists) {
                throw ApiError.conflict('Email or phone already in use');
            }
        } else {
            const existing = await this.repository.findUserByEmail(data.email);
            if (existing) {
                throw ApiError.conflict('Email already in use');
            }
        }

        const passwordHash = await hashPassword(data.password);

        await this.repository.createUser({
            email: data.email,
            phone: data.phone ?? '',
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            isEmailVerified: false,
            isPhoneVerified: false,
        }).catch((error: any) => {
            if (error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint')) {
                throw ApiError.conflict('Email or phone already in use');
            }
            throw error;
        });

        return { message: 'Admin registered successfully' };
    }

    /**
     * Login user
     * POST /v1/auth/login
     * 
     * Business Rules:
     * 1. Find user by email OR phone
     * 2. Verify password
     * 3. Check status (must be ACTIVE)
     * 4. Generate tokens
     * 5. Create login session with HASHED refresh token
     */
    async login(
        identifier: string,
        password: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<LoginResponse> {
        this.logger.info({ identifier, userAgent }, 'login_attempt_started');
        
        // 1. Find user by email OR phone
        const user = await this.repository.findByIdentifier(identifier);
        if (!user) {
            this.logger.warn({ identifier }, 'login_user_not_found');
            throw ApiError.unauthorized('User account not found. Please check your email/phone or create a new account.');
        }

        // 2. Verify password
        const isPasswordValid = await comparePassword(password, user.passwordHash);
        if (!isPasswordValid) {
            this.logger.warn({ userId: user.id, identifier }, 'login_invalid_password');
            throw ApiError.unauthorized('Incorrect password. Please try again.');
        }

        // 3. Check status (must be ACTIVE). A temporary seller suspension
        //    whose period has ended is lifted here.
        if (user.status === 'SUSPENDED' && user.role === 'SELLER' && (await sellerSuspensionService.liftIfExpired(user.id))) {
            user.status = 'ACTIVE';
        }
        if (user.status !== 'ACTIVE') {
            this.logger.warn({ userId: user.id, status: user.status, role: user.role }, 'login_account_inactive');
            if (user.role === 'SELLER' && user.status === 'SUSPENDED') {
                const { reason, until } = await sellerSuspensionService.describe(user.id);
                const when = until
                    ? ` until ${until.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}`
                    : ' until our team completes its review';
                throw ApiError.forbidden(
                    `Your seller account is temporarily suspended${when}.${reason ? ` Reason: ${reason}.` : ''} Contact support if you think this is a mistake.`
                );
            }
            if (user.role === 'SELLER') {
                throw ApiError.forbidden('Your seller account is pending admin approval.');
            }
            throw ApiError.forbidden('Your account is not active. Please contact support.');
        }

        this.logger.info({ userId: user.id, role: user.role, identifier }, 'login_password_verified');

        // 4. Return response
        this.logger.info({ userId: user.id, role: user.role }, 'login_tokens_issued');
        return this.issueTokens({
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        }, userAgent, ipAddress);
    }

    async requestOtp(input: { phone?: string | undefined }): Promise<{ message: string }> {
        const phone = input.phone ? normalizeIndianMobile(input.phone) : undefined;
        this.logger.info({ phone: phone ? '[present]' : null }, 'request_otp_started');
        if (!phone) {
            this.logger.warn({ phone: null }, 'request_otp_missing_phone');
            throw ApiError.badRequest('Phone number is required');
        }

        const user = await this.repository.findUserByPhone(phone);
        if (!user) {
            this.logger.warn({ phone: '[present]' }, 'request_otp_user_not_found');
            throw ApiError.notFound('User not found');
        }
        if (user.status !== 'ACTIVE') {
            this.logger.warn({ phone: '[present]', userId: user.id, status: user.status }, 'request_otp_account_not_active');
            throw ApiError.forbidden('Account not active');
        }
        const channel = await otpService.sendPhoneOtp(user.id, phone, user.email, 'login');
        this.logger.info({ phone: '[present]', userId: user.id, channel }, 'request_otp_sent');
        return {
            message:
                channel === 'email'
                    ? 'SMS delivery is unavailable — we emailed your OTP instead. Please check your email.'
                    : 'OTP sent to your mobile number',
        };
    }

    /**
     * Re-send the code for a registration still waiting for verification.
     * The pending account details are reused from the original sign-up.
     */
    async resendSignupOtp(input: { phone?: string | undefined; email?: string | undefined }): Promise<MessageResponse> {
        const key = input.phone
            ? normalizeIndianMobile(input.phone)
            : (input.email ?? '').trim().toLowerCase();
        const payload = key ? await otpService.getLatestSignupPayloadForKey(key) : null;
        if (!payload) {
            throw ApiError.badRequest('Your sign-up has expired. Please register again.');
        }
        if (await this.repository.existsByEmailOrPhone(payload.email, payload.phone)) {
            throw ApiError.conflict('This account is already verified. Please sign in.');
        }
        const channel = await otpService.sendSignupOtp(payload);
        return {
            message: channel === 'email' ? 'OTP sent to your email address' : 'OTP sent to your mobile number',
        };
    }

    async verifyOtp(
        input: { phone?: string | undefined; email?: string | undefined; otp: string },
        userAgent?: string,
        ipAddress?: string,
    ): Promise<LoginResponse | MessageResponse> {
        const phone = input.phone ? normalizeIndianMobile(input.phone) : undefined;
        this.logger.info({ phone: phone ? '[present]' : null, email: input.email ? '[present]' : null, otpLength: input.otp?.length ?? 0 }, 'verify_otp_started');
        if (phone) {
            return this.verifyOtpFlow('phone', phone, input.otp, userAgent, ipAddress);
        }
        if (input.email) {
            return this.verifyOtpFlow('email', input.email, input.otp, userAgent, ipAddress);
        }
        this.logger.warn({ phone: null }, 'verify_otp_missing_phone');
        throw ApiError.badRequest('Phone number or email is required');
    }

    private async verifyOtpFlow(
        channel: 'phone' | 'email',
        identifier: string,
        code: string,
        userAgent?: string,
        ipAddress?: string,
    ): Promise<LoginResponse | MessageResponse> {
        this.logger.debug({ channel, userAgent: userAgent ?? null, ipAddress: ipAddress ?? null }, 'verify_otp_lookup');
        const otp = channel === 'phone'
            ? await otpService.verifyPhoneOtp(identifier, code)
            : await otpService.verifyEmailOtp(identifier, code);
        if (!otp.userId) {
            const payload = otp.payload as SignupOtpPayload | null;
            if (!payload) {
                this.logger.warn({ phone: '[present]' }, 'verify_phone_otp_missing_payload');
                throw ApiError.badRequest('Invalid or expired OTP');
            }

            const exists = await this.repository.existsByEmailOrPhone(payload.email, payload.phone);
            if (exists) {
                this.logger.warn({ email: payload.email, phone: '[present]' }, 'verify_phone_otp_conflict');
                throw ApiError.conflict('Email or phone already in use');
            }

            const status = payload.role === 'SELLER' ? 'PENDING' : 'ACTIVE';
            const created = await this.repository.createUser({
                email: payload.email,
                phone: payload.phone,
                whatsappNumber: payload.role === 'SELLER' ? (payload.whatsappNumber ?? null) : null,
                passwordHash: payload.passwordHash,
                role: payload.role,
                status,
                // Whichever channel received the code is now verified.
                isEmailVerified: channel === 'email',
                isPhoneVerified: channel === 'phone',
            }).catch((error: any) => {
                if (error?.code === 'P2002' || String(error?.message ?? '').includes('Unique constraint')) {
                    throw ApiError.conflict('Email or phone already in use');
                }
                throw error;
            });

            if (created.role === 'SELLER') {
                this.logger.info({ email: created.email, userId: created.id, role: created.role }, 'verify_phone_otp_seller_created');
                return {
                    message: 'Phone verified. Seller account pending admin approval.',
                };
            }

            this.logger.info({ email: created.email, userId: created.id, role: created.role }, 'verify_phone_otp_user_created');

            return this.issueTokens({
                id: created.id,
                email: created.email,
                phone: created.phone,
                role: created.role,
                status: created.status,
                isEmailVerified: created.isEmailVerified,
                isPhoneVerified: created.isPhoneVerified,
            }, userAgent, ipAddress);
        }

        const user = await this.repository.findUserById(otp.userId);
        if (!user) {
            this.logger.warn({ phone: '[present]', userId: otp.userId }, 'verify_phone_otp_user_not_found');
            throw ApiError.notFound('User not found');
        }

        if (user.status !== 'ACTIVE') {
            this.logger.warn({ phone: '[present]', userId: user.id, status: user.status }, 'verify_phone_otp_account_not_active');
            throw ApiError.forbidden('Account not active');
        }

        const alreadyVerified = channel === 'phone' ? user.isPhoneVerified : user.isEmailVerified;
        const updated = alreadyVerified
            ? user
            : await this.repository.updateUser(
                user.id,
                channel === 'phone' ? { isPhoneVerified: true } : { isEmailVerified: true },
            );

        return this.issueTokens({
            id: updated.id,
            email: updated.email,
            phone: updated.phone,
            role: updated.role,
            status: updated.status,
            isEmailVerified: updated.isEmailVerified,
            isPhoneVerified: updated.isPhoneVerified,
        }, userAgent, ipAddress);
    }

    /**
     * Refresh tokens with rotation
     * POST /v1/auth/refresh
     * 
     * Business Rules:
     * 1. Verify refresh token JWT signature & expiry
     * 2. Extract userId from payload
     * 3. Find matching session by comparing token hash
     * 4. If not found / hash mismatch → reject this request only.
     *    A mismatch is almost always a benign rotation race (two browser
     *    tabs refreshing the same cookie concurrently), not an attack —
     *    invalidating other sessions here logged users out of every
     *    device whenever they had two tabs open.
     * 5. Generate new tokens
     * 6. Update session with new hashed refresh token
     * 7. Return new tokens
     */
    async refreshTokens(refreshToken: string): Promise<TokenRefreshResponse> {
        // 1. Verify refresh token JWT (throws if invalid/expired)
        const decoded = verifyRefreshToken(refreshToken);
        const { userId, sessionId } = decoded;

        // 2. Look up the specific session by ID (O(1) instead of O(N) bcrypt loop)
        const session = await this.repository.findSessionByIdAndUser(sessionId, userId);
        if (!session) {
            // Session already deleted (logout, expiry cleanup) — stale cookie.
            this.logger.warn({ userId, sessionId }, 'refresh_session_not_found');
            throw ApiError.unauthorized('Invalid refresh token');
        }

        // 3. Compare refresh token hash (single bcrypt call instead of N)
        const isMatch = await compareToken(refreshToken, session.refreshToken);
        if (!isMatch) {
            // Token was already rotated — concurrent refresh from another
            // tab/request. Reject without invalidating the session so the
            // winner's token keeps working; the loser retries client-side.
            this.logger.warn({ userId, sessionId }, 'refresh_token_rotation_mismatch');
            throw ApiError.unauthorized('Invalid refresh token');
        }

        // Check session expiry
        if (session.expiresAt < new Date()) {
            await this.repository.deleteSession(session.id);
            throw ApiError.unauthorized('Refresh token has expired');
        }

        // 4. Get user data for new access token
        const user = await this.repository.findUserById(userId);
        if (!user) {
            await this.repository.deleteSession(session.id);
            throw ApiError.unauthorized('User not found');
        }

        // Check user status
        if (user.status !== 'ACTIVE') {
            await this.repository.deleteSession(session.id);
            throw ApiError.forbidden('Account not active');
        }

        // 5. Generate new tokens
        const newAccessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        });

        const refreshExpiry = refreshExpiryFor(user.role);
        const newRefreshToken = generateRefreshToken({
            userId: user.id,
            sessionId: sessionId,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
        }, refreshExpiry);

        // 6. Hash new refresh token and update session. The expiry slides
        // forward on every refresh, so an active session never times out.
        const hashedNewRefreshToken = await hashToken(newRefreshToken);
        const newExpiresAt = new Date(Date.now() + ms(refreshExpiry as StringValue));
        await this.repository.updateSessionRefreshToken(session.id, hashedNewRefreshToken, newExpiresAt);

        // 7. Return new tokens
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }

    /**
     * Logout current session
     * POST /v1/auth/logout
     * 
     * Business Rules:
     * 1. Find matching session by userId and refresh token hash
     * 2. Delete the session
     * 3. Return success (idempotent - success even if session not found)
     */
    async logout(userId: string, refreshToken?: string): Promise<MessageResponse> {
        if (refreshToken) {
            // Decode the JWT to get the sessionId, then delete that single session (O(1))
            try {
                const decoded = verifyRefreshToken(refreshToken);
                if (decoded.sessionId) {
                    await this.repository.deleteUserSession(userId, decoded.sessionId);
                }
            } catch {
                // Token may be expired/invalid; that's fine for logout — it's idempotent
            }
        }
        // Idempotent - always return success
        return { message: 'Logged out successfully' };
    }

    /**
     * List all user sessions
     * GET /v1/auth/sessions
     */
    async listSessions(userId: string): Promise<ListSessionsResponse> {
        const sessions = await this.repository.getSessionsForUser(userId);

        return {
            sessions: sessions.map(session => ({
                sessionId: session.id,
                userAgent: session.userAgent,
                ipAddress: session.ipAddress,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            })),
        };
    }

    /**
     * Revoke a specific session
     * DELETE /v1/auth/sessions/:sessionId
     */
    async revokeSession(userId: string, sessionId: string): Promise<MessageResponse> {
        const deleted = await this.repository.deleteUserSession(userId, sessionId);

        if (!deleted) {
            throw ApiError.notFound('Session not found');
        }

        return { message: 'Session revoked successfully' };
    }

    // ========================================================================
    // PASSWORD RESET FLOW
    // ========================================================================

    /**
     * Forgot Password — request a password-reset OTP (via SMS, email fallback)
     * POST /v1/auth/forgot-password
     *
     * Security:
     *   - Generic success response regardless of whether the account exists,
     *     to prevent user-existence enumeration.
     *   - OTP is hashed (SHA-256) before storage, keyed by phone number.
     *   - Previous unused password-reset OTPs remain (only the latest valid
     *     one is checked during reset).
     */
    async forgotPassword(phone: string): Promise<MessageResponse> {
        const normalizedPhone = normalizeIndianMobile(phone);
        const user = await this.repository.findUserByPhone(normalizedPhone);

        // Always return a generic message to avoid leaking user existence
        if (!user) {
            return { message: 'If an account with that number exists, an OTP has been sent.' };
        }

        await otpService.sendPasswordResetOtp(user.id, normalizedPhone, user.email);

        return { message: 'If an account with that number exists, an OTP has been sent.' };
    }

    /**
     * Reset Password — verify OTP and set a new password
     * POST /v1/auth/reset-password
     *
     * Security:
     *   - Finds the latest valid (non-expired, non-used) PASSWORD_RESET OTP
     *     keyed by phone number.
     *   - Compares the hashed OTP.
     *   - Hashes the new password with bcrypt.
     *   - Marks the OTP as used.
     *   - Invalidates ALL existing login sessions (force re-login).
     */
    async resetPassword(
        phone: string,
        otp: string,
        newPassword: string
    ): Promise<MessageResponse> {
        const normalizedPhone = normalizeIndianMobile(phone);

        // 1. Find latest valid password-reset OTP
        const otpRecord = await otpRepository.findLatestValid(normalizedPhone, OtpPurpose.PASSWORD_RESET);
        if (!otpRecord) {
            throw ApiError.badRequest('Invalid or expired OTP');
        }

        // 2. Compare hashed OTP
        const hashed = hashOtp(otp);
        if (otpRecord.codeHash !== hashed) {
            throw ApiError.badRequest('Invalid or expired OTP');
        }

        // 3. Look up the user
        const user = await this.repository.findUserByPhone(normalizedPhone);
        if (!user) {
            throw ApiError.badRequest('Invalid or expired OTP');
        }

        // 4. Hash new password and update
        const passwordHash = await hashPassword(newPassword);
        await this.repository.updateUser(user.id, { passwordHash });

        // 5. Mark OTP as used
        await otpRepository.markUsed(otpRecord.id);

        // 6. Invalidate all sessions → forces re-login everywhere
        await this.repository.deleteAllUserSessions(user.id);

        return { message: 'Password reset successfully. Please login with your new password.' };
    }
}

// Export singleton instance with default repository
export const authService = new AuthService(authRepository);
