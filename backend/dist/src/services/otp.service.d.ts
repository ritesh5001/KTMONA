import { OtpPurpose } from '@prisma/client';
/** Which channel an OTP was actually delivered through. */
export type OtpChannel = 'sms' | 'email';
export type SignupOtpPayload = {
    email: string;
    phone: string;
    whatsappNumber?: string;
    passwordHash: string;
    role: 'USER' | 'SELLER';
    fullName?: string;
};
export declare class OtpService {
    private readonly logger;
    /**
     * Deliver an OTP code: SMS (via AquaSMS) primary, email fallback.
     * Falls back to email only when SMS delivery fails AND a fallback email
     * address is available. Throws if neither channel succeeds — a caller must
     * never be able to report "OTP sent" when nothing was sent.
     */
    private deliverOtp;
    private renderOtpEmail;
    /**
     * Send an OTP to an existing user's mobile number (login / re-verify).
     * @param fallbackEmail address used only if SMS delivery fails.
     */
    sendPhoneOtp(userId: string, phone: string, fallbackEmail?: string | null, mode?: 'login' | 'verify'): Promise<OtpChannel>;
    /**
     * Send a signup OTP. The OTP record is keyed by phone and carries the
     * pending account payload; the account is created on verification.
     * Delivered by SMS with email fallback.
     */
    sendSignupOtp(payload: SignupOtpPayload): Promise<void>;
    /**
     * Send a password-reset OTP keyed by phone (purpose PASSWORD_RESET).
     * Delivered by SMS with email fallback.
     */
    sendPasswordResetOtp(userId: string, phone: string, fallbackEmail?: string | null): Promise<void>;
    verifyPhoneOtp(phone: string, code: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        userId: string | null;
        email: string;
        codeHash: string;
        purpose: OtpPurpose;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
        payload: import(".prisma/client").Prisma.JsonValue | null;
    }, unknown> & {}>;
    getLatestSignupPayload(phone: string): Promise<SignupOtpPayload | null>;
}
export declare const otpService: OtpService;
//# sourceMappingURL=otp.service.d.ts.map