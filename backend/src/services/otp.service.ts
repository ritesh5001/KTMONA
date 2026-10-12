import { OtpPurpose } from '@prisma/client';
import { otpRepository } from '../repositories/otp.repository.js';
import { generateOtpCode, hashOtp } from '../utils/otp.util.js';
import { ApiError } from '../errors/ApiError.js';
import { aquaSmsService, isSmsConfigured } from './aquasms.service.js';
import { normalizeIndianMobile } from '../utils/phone.util.js';
import { env } from '../config/env.js';
import { sendEmail } from '../notifications/email/resend.client.js';
import { renderBrandedEmail } from '../notifications/email/templates/layout.js';
import { authLogger } from '../config/logger.js';

const OTP_EXPIRY_MINUTES = 10;

type OtpContext = 'login' | 'verify' | 'signup' | 'reset';

/** Which channel an OTP was actually delivered through. */
export type OtpChannel = 'sms' | 'email';

type OtpRoute = { keyType: 'email' | 'phone'; key: string };

/**
 * Where a code went. `keyType`/`key` is what the user sends back with the code
 * (`{ email }` or `{ phone }`); `channel` is how it was actually delivered
 * (an SMS key can fall back to email delivery).
 */
export type OtpDelivery = OtpRoute & { channel: OtpChannel };

/** Build the OTP message body from the DLT-approved template. */
function renderOtpSms(code: string): string {
    return env.AQUASMS_OTP_TEMPLATE.replaceAll('{otp}', code);
}

export type SignupOtpPayload = {
    /** At least one of email / phone is set (customers may sign up with either). */
    email: string | null;
    phone: string | null;
    whatsappNumber?: string;
    passwordHash: string;
    role: 'USER' | 'SELLER';
    fullName?: string;
};

export class OtpService {
    private readonly logger = authLogger.child({ component: 'otp-service' });

    /**
     * Deliver an OTP code: SMS (via AquaSMS) primary, email fallback.
     * Falls back to email only when SMS delivery fails AND a fallback email
     * address is available. Throws if neither channel succeeds — a caller must
     * never be able to report "OTP sent" when nothing was sent.
     */
    private async deliverOtp(opts: {
        phone: string;
        code: string;
        context: OtpContext;
        fallbackEmail?: string | null | undefined;
    }): Promise<OtpChannel> {
        const normalizedPhone = normalizeIndianMobile(opts.phone);

        if (isSmsConfigured()) {
            try {
                const { messageId } = await aquaSmsService.sendSms(
                    normalizedPhone,
                    renderOtpSms(opts.code),
                );
                this.logger.info(
                    { phone: normalizedPhone, context: opts.context, messageId },
                    'sms_otp_sent',
                );
                return 'sms';
            } catch (err) {
                this.logger.warn(
                    { phone: normalizedPhone, context: opts.context, err: err instanceof Error ? err.message : String(err) },
                    'sms_otp_failed_fallback_email',
                );
            }
        } else {
            this.logger.warn(
                { phone: normalizedPhone, context: opts.context },
                'sms_not_configured_fallback_email',
            );
        }

        const fallbackEmail = opts.fallbackEmail?.trim().toLowerCase();
        if (!fallbackEmail) {
            // Neither channel is usable. Surface a clear error instead of
            // letting the caller report a false "OTP sent" success.
            throw ApiError.internal(
                'We could not send your OTP right now. Please try again shortly.',
            );
        }
        const { subject, html } = this.renderOtpEmail(opts.code, opts.context);
        await sendEmail(fallbackEmail, subject, html);
        this.logger.info({ email: fallbackEmail, context: opts.context }, 'otp_email_fallback_sent');
        return 'email';
    }

    private renderOtpEmail(code: string, context: OtpContext): { subject: string; html: string } {
        if (context === 'reset') {
            return {
                subject: 'Reset your KTMONA password',
                html: renderBrandedEmail({
                    preheader: 'Your password reset verification code for KTMONA.',
                    eyebrow: 'Password Recovery',
                    title: 'Reset Your Password',
                    message: [
                        'Use the one-time code below to reset your KTMONA account password.',
                        `This code expires in ${OTP_EXPIRY_MINUTES} minutes and can only be used once.`,
                    ],
                    details: [{ label: 'Reset Code', value: code }],
                    accentText: 'If you did not request this reset, you can safely ignore this email.',
                }),
            };
        }

        const isLogin = context === 'login';
        return {
            subject: isLogin ? 'Your KTMONA login code' : 'Verify your KTMONA account',
            html: renderBrandedEmail({
                preheader: isLogin ? 'Your KTMONA login code.' : 'Your KTMONA verification code.',
                eyebrow: isLogin ? 'Login OTP' : 'Account Verification',
                title: isLogin ? 'Complete Your Login' : 'Verify Your Account',
                message: [
                    isLogin
                        ? 'Use the one-time code below to sign in to your KTMONA account.'
                        : 'Use the one-time code below to verify your KTMONA account.',
                    `This code is valid for ${OTP_EXPIRY_MINUTES} minutes and can only be used once.`,
                ],
                details: [{ label: 'Verification Code', value: code }],
                accentText: 'For your security, never share this code with anyone.',
            }),
        };
    }

    /**
     * Decide where a code goes and which key the OTP record is stored under.
     * The key is what the user later sends back to verify (email or phone).
     */
    private route(email: string | null, phone: string | null): OtpRoute {
        const smsFirst = env.OTP_CHANNEL === 'sms';
        if (smsFirst && phone) return { keyType: 'phone', key: phone };
        if (email) return { keyType: 'email', key: email };
        // Email mode, but the account has no email (older phone-only accounts).
        if (phone && isSmsConfigured()) return { keyType: 'phone', key: phone };
        throw ApiError.badRequest(
            phone
                ? 'Add an email address to your account to receive the OTP.'
                : 'Enter your email address to receive the OTP.',
        );
    }

    /** Store a fresh code under the chosen key and deliver it. */
    private async issue(opts: {
        email: string | null | undefined;
        phone: string | null | undefined;
        context: OtpContext;
        purpose: OtpPurpose;
        userId?: string;
        payload?: SignupOtpPayload;
    }): Promise<OtpDelivery> {
        const email = opts.email?.trim().toLowerCase() || null;
        const phone = opts.phone ? normalizeIndianMobile(opts.phone) : null;
        if (phone && !/^\d{10}$/.test(phone)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }
        const route = this.route(email, phone);
        const code = generateOtpCode();

        await otpRepository.createOtp({
            ...(opts.userId ? { userId: opts.userId } : {}),
            email: route.key,
            codeHash: hashOtp(code),
            purpose: opts.purpose,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
            ...(opts.payload ? { payload: { ...opts.payload, email, phone } } : {}),
        });

        if (route.keyType === 'email') {
            const { subject, html } = this.renderOtpEmail(code, opts.context);
            await sendEmail(route.key, subject, html);
            this.logger.info({ email: route.key, context: opts.context }, 'otp_email_sent');
            return { channel: 'email', keyType: 'email', key: route.key };
        }

        const channel = await this.deliverOtp({ phone: route.key, code, context: opts.context, fallbackEmail: email });
        return { channel, keyType: 'phone', key: route.key };
    }

    /** OTP for an existing account (OTP login / re-verify). */
    async sendUserOtp(
        user: { id: string; email: string | null; phone: string | null },
        mode: 'login' | 'verify' = 'login',
    ): Promise<OtpDelivery> {
        this.logger.info({ userId: user.id, mode }, 'user_otp_create');
        return this.issue({ email: user.email, phone: user.phone, context: mode, purpose: OtpPurpose.EMAIL_VERIFY, userId: user.id });
    }

    /**
     * Sign-up OTP. The record carries the pending account; the account is
     * created only once the code is verified.
     */
    async sendSignupOtp(payload: SignupOtpPayload): Promise<OtpDelivery> {
        // In email mode a new account always needs an email for its code.
        if (!payload.email && (env.OTP_CHANNEL === 'email' || !payload.phone)) {
            throw ApiError.badRequest('Enter your email address. We send the verification code (OTP) there.');
        }
        this.logger.info({ role: payload.role, hasPhone: Boolean(payload.phone) }, 'signup_otp_create');
        return this.issue({ email: payload.email, phone: payload.phone, context: 'signup', purpose: OtpPurpose.EMAIL_VERIFY, payload });
    }

    /** Password-reset OTP (purpose PASSWORD_RESET), to the account's email by default. */
    async sendPasswordResetOtp(user: { id: string; email: string | null; phone: string | null }): Promise<OtpDelivery> {
        this.logger.info({ userId: user.id }, 'password_reset_otp_create');
        return this.issue({ email: user.email, phone: user.phone, context: 'reset', purpose: OtpPurpose.PASSWORD_RESET, userId: user.id });
    }

    async verifyPhoneOtp(phone: string, code: string) {
        return this.verifyOtpForKey(normalizeIndianMobile(phone), code);
    }

    /** Verify the latest OTP for an email-only signup. */
    async verifyEmailOtp(email: string, code: string) {
        return this.verifyOtpForKey(email.trim().toLowerCase(), code);
    }

    private async verifyOtpForKey(normalizedPhone: string, code: string) {
        const otp = await otpRepository.findLatestValid(normalizedPhone, OtpPurpose.EMAIL_VERIFY);
        if (!otp) {
            this.logger.warn({ phone: normalizedPhone }, 'phone_otp_not_found');
            throw ApiError.badRequest('Invalid or expired OTP');
        }

        const hashed = hashOtp(code);
        if (otp.codeHash !== hashed) {
            this.logger.warn({ phone: normalizedPhone }, 'phone_otp_invalid_code');
            throw ApiError.badRequest('Invalid or expired OTP');
        }

        await otpRepository.markUsed(otp.id);
        return otp;
    }

    async getLatestSignupPayload(phone: string): Promise<SignupOtpPayload | null> {
        return this.getLatestSignupPayloadForKey(normalizeIndianMobile(phone));
    }

    /** The pending sign-up stored under a phone number or (email-only) address. */
    async getLatestSignupPayloadForKey(key: string): Promise<SignupOtpPayload | null> {
        const latest = await otpRepository.findLatestByEmail(key, OtpPurpose.EMAIL_VERIFY);
        if (!latest || !('payload' in latest) || !latest.payload) {
            return null;
        }
        return latest.payload as SignupOtpPayload;
    }
}

export const otpService = new OtpService();
