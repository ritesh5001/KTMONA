import { z } from 'zod';
/**
 * User Registration Validation Schema
 * POST /v1/auth/register
 */
export declare const registerUserSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    phone: string;
    fullName: string;
    password: string;
}, {
    email: string;
    phone: string;
    fullName: string;
    password: string;
}>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
/**
 * Seller Registration Validation Schema
 * POST /v1/seller/register
 */
export declare const registerSellerSchema: z.ZodObject<{
    email: z.ZodString;
    phone: z.ZodString;
    whatsappNumber: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    phone: string;
    whatsappNumber: string;
    password: string;
}, {
    email: string;
    phone: string;
    whatsappNumber: string;
    password: string;
}>;
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
/**
 * Admin Registration Validation Schema
 * POST /v1/auth/admin/register
 */
export declare const registerAdminSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    department?: string | undefined;
    designation?: string | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string | undefined;
    department?: string | undefined;
    designation?: string | undefined;
}>;
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
/**
 * Login Validation Schema
 * POST /v1/auth/login
 */
export declare const loginSchema: z.ZodObject<{
    identifier: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    password: string;
}, {
    identifier: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
/**
 * Refresh Token Validation Schema
 * POST /v1/auth/refresh
 */
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
/**
 * Logout Validation Schema
 * POST /v1/auth/logout
 */
export declare const logoutSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string | undefined;
}, {
    refreshToken?: string | undefined;
}>;
export type LogoutInput = z.infer<typeof logoutSchema>;
/**
 * Request OTP Validation Schema
 * POST /v1/auth/request-otp
 */
export declare const requestOtpSchema: z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
/**
 * Verify OTP Validation Schema
 * POST /v1/auth/verify-otp
 */
export declare const verifyOtpSchema: z.ZodObject<{
    phone: z.ZodString;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    otp: string;
}, {
    phone: string;
    otp: string;
}>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
/**
 * Forgot Password Validation Schema
 * POST /v1/auth/forgot-password
 */
export declare const forgotPasswordSchema: z.ZodObject<{
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
/**
 * Reset Password Validation Schema
 * POST /v1/auth/reset-password
 */
export declare const resetPasswordSchema: z.ZodObject<{
    phone: z.ZodString;
    otp: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    otp: string;
    newPassword: string;
}, {
    phone: string;
    otp: string;
    newPassword: string;
}>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
//# sourceMappingURL=auth.validation.d.ts.map