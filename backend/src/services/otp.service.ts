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
     * Send an OTP to an existing user's mobile number (login / re-verify).
     * @param fallbackEmail address used only if SMS delivery fails.
     */
    async sendPhoneOtp(
        userId: string,
        phone: string,
        fallbackEmail?: string | null,
        mode: 'login' | 'verify' = 'login',
    ): Promise<OtpChannel> {
        const normalizedPhone = normalizeIndianMobile(phone);
        if (!/^\d{10}$/.test(normalizedPhone)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }

        const code = generateOtpCode();
        const codeHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        this.logger.info({ userId, phone: normalizedPhone, mode }, 'phone_otp_create');

        await otpRepository.createOtp({
            userId,
            email: normalizedPhone,
            codeHash,
            purpose: OtpPurpose.EMAIL_VERIFY,
            expiresAt,
        });

        return this.deliverOtp({ phone: normalizedPhone, code, context: mode, fallbackEmail });
    }

    /**
     * Send a signup OTP. The OTP record is keyed by phone and carries the
     * pending account payload; the account is created on verification.
     * Delivered by SMS with email fallback.
     */
    async sendSignupOtp(payload: SignupOtpPayload): Promise<OtpChannel> {
        const normalizedEmail = payload.email?.trim().toLowerCase() || null;

        if (!payload.phone) {
            // Email-only signup: the OTP record is keyed by the email address
            // and the code is emailed directly.
            if (!normalizedEmail) {
                throw ApiError.badRequest('Enter an email address or a mobile number');
            }
            const code = generateOtpCode();
            await otpRepository.createOtp({
                email: normalizedEmail,
                codeHash: hashOtp(code),
                purpose: OtpPurpose.EMAIL_VERIFY,
                expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
                payload: { ...payload, email: normalizedEmail, phone: null },
            });
            const { subject, html } = this.renderOtpEmail(code, 'signup');
            await sendEmail(normalizedEmail, subject, html);
            this.logger.info({ email: normalizedEmail, role: payload.role }, 'signup_email_otp_sent');
            return 'email';
        }

        const normalizedPhone = normalizeIndianMobile(payload.phone);
        if (!/^\d{10}$/.test(normalizedPhone)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }

        const code = generateOtpCode();
        const codeHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        this.logger.info({ phone: normalizedPhone, role: payload.role, hasWhatsapp: Boolean(payload.whatsappNumber) }, 'signup_otp_create');

        await otpRepository.createOtp({
            email: normalizedPhone,
            codeHash,
            purpose: OtpPurpose.EMAIL_VERIFY,
            expiresAt,
            payload: {
                ...payload,
                email: normalizedEmail,
                phone: normalizedPhone,
            },
        });

        return this.deliverOtp({ phone: normalizedPhone, code, context: 'signup', fallbackEmail: normalizedEmail });
    }

    /**
     * Send a password-reset OTP keyed by phone (purpose PASSWORD_RESET).
     * Delivered by SMS with email fallback.
     */
    async sendPasswordResetOtp(userId: string, phone: string, fallbackEmail?: string | null): Promise<void> {
        const normalizedPhone = normalizeIndianMobile(phone);
        if (!/^\d{10}$/.test(normalizedPhone)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }

        const code = generateOtpCode();
        const codeHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        this.logger.info({ userId, phone: normalizedPhone }, 'password_reset_otp_create');

        await otpRepository.createOtp({
            userId,
            email: normalizedPhone,
            codeHash,
            purpose: OtpPurpose.PASSWORD_RESET,
            expiresAt,
        });

        await this.deliverOtp({ phone: normalizedPhone, code, context: 'reset', fallbackEmail });
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
