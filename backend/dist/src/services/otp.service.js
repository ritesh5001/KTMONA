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
/** Build the OTP message body from the DLT-approved template. */
function renderOtpSms(code) {
    return env.AQUASMS_OTP_TEMPLATE.replaceAll('{otp}', code);
}
export class OtpService {
    logger = authLogger.child({ component: 'otp-service' });
    /**
     * Deliver an OTP code: SMS (via AquaSMS) primary, email fallback.
     * Falls back to email only when SMS delivery fails AND a fallback email
     * address is available. Throws if neither channel succeeds — a caller must
     * never be able to report "OTP sent" when nothing was sent.
     */
    async deliverOtp(opts) {
        const normalizedPhone = normalizeIndianMobile(opts.phone);
        if (isSmsConfigured()) {
            try {
                const { messageId } = await aquaSmsService.sendSms(normalizedPhone, renderOtpSms(opts.code));
                this.logger.info({ phone: normalizedPhone, context: opts.context, messageId }, 'sms_otp_sent');
                return 'sms';
            }
            catch (err) {
                this.logger.warn({ phone: normalizedPhone, context: opts.context, err: err instanceof Error ? err.message : String(err) }, 'sms_otp_failed_fallback_email');
            }
        }
        else {
            this.logger.warn({ phone: normalizedPhone, context: opts.context }, 'sms_not_configured_fallback_email');
        }
        const fallbackEmail = opts.fallbackEmail?.trim().toLowerCase();
        if (!fallbackEmail) {
            // Neither channel is usable. Surface a clear error instead of
            // letting the caller report a false "OTP sent" success.
            throw ApiError.internal('We could not send your OTP right now. Please try again shortly.');
        }
        const { subject, html } = this.renderOtpEmail(opts.code, opts.context);
        await sendEmail(fallbackEmail, subject, html);
        this.logger.info({ email: fallbackEmail, context: opts.context }, 'otp_email_fallback_sent');
        return 'email';
    }
    renderOtpEmail(code, context) {
        if (context === 'reset') {
            return {
                subject: 'Reset your Tatvivah password',
                html: renderBrandedEmail({
                    preheader: 'Your password reset verification code for Tatvivah.',
                    eyebrow: 'Password Recovery',
                    title: 'Reset Your Password',
                    message: [
                        'Use the one-time code below to reset your Tatvivah account password.',
                        `This code expires in ${OTP_EXPIRY_MINUTES} minutes and can only be used once.`,
                    ],
                    details: [{ label: 'Reset Code', value: code }],
                    accentText: 'If you did not request this reset, you can safely ignore this email.',
                }),
            };
        }
        const isLogin = context === 'login';
        return {
            subject: isLogin ? 'Your Tatvivah login code' : 'Verify your Tatvivah account',
            html: renderBrandedEmail({
                preheader: isLogin ? 'Your Tatvivah login code.' : 'Your Tatvivah verification code.',
                eyebrow: isLogin ? 'Login OTP' : 'Account Verification',
                title: isLogin ? 'Complete Your Login' : 'Verify Your Account',
                message: [
                    isLogin
                        ? 'Use the one-time code below to sign in to your Tatvivah account.'
                        : 'Use the one-time code below to verify your Tatvivah account.',
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
    async sendPhoneOtp(userId, phone, fallbackEmail, mode = 'login') {
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
    async sendSignupOtp(payload) {
        const normalizedPhone = normalizeIndianMobile(payload.phone);
        if (!/^\d{10}$/.test(normalizedPhone)) {
            throw ApiError.badRequest('A valid 10-digit mobile number is required');
        }
        const normalizedEmail = payload.email.trim().toLowerCase();
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
        await this.deliverOtp({ phone: normalizedPhone, code, context: 'signup', fallbackEmail: normalizedEmail });
    }
    /**
     * Send a password-reset OTP keyed by phone (purpose PASSWORD_RESET).
     * Delivered by SMS with email fallback.
     */
    async sendPasswordResetOtp(userId, phone, fallbackEmail) {
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
    async verifyPhoneOtp(phone, code) {
        const normalizedPhone = normalizeIndianMobile(phone);
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
    async getLatestSignupPayload(phone) {
        const normalizedPhone = normalizeIndianMobile(phone);
        const latest = await otpRepository.findLatestByEmail(normalizedPhone, OtpPurpose.EMAIL_VERIFY);
        if (!latest || !('payload' in latest) || !latest.payload) {
            return null;
        }
        return latest.payload;
    }
}
export const otpService = new OtpService();
//# sourceMappingURL=otp.service.js.map