import { z } from 'zod';

/**
 * User Registration Validation Schema
 * POST /v1/auth/register
 */
export const registerUserSchema = z.object({
    fullName: z
        .string()
        .min(2, 'Full name must be at least 2 characters'),

    email: z
        .string()
        .email('Invalid email address'),

    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),

    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least 1 number'),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

/**
 * Seller Registration Validation Schema
 * POST /v1/seller/register
 */
export const registerSellerSchema = z.object({
    email: z
        .string()
        .email('Invalid email address'),

    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),

    whatsappNumber: z
        .string()
        .regex(/^\d{10,15}$/, 'WhatsApp number must be 10-15 digits'),

    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least 1 number'),
});

export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;

/**
 * Admin Registration Validation Schema
 * POST /v1/auth/admin/register
 */
export const registerAdminSchema = z.object({
    firstName: z
        .string()
        .min(2, 'First name must be at least 2 characters'),

    lastName: z
        .string()
        .min(2, 'Last name must be at least 2 characters'),

    email: z
        .string()
        .email('Invalid email address'),

    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits')
        .optional(),

    department: z
        .string()
        .min(2, 'Department must be at least 2 characters')
        .optional(),

    designation: z
        .string()
        .min(2, 'Designation must be at least 2 characters')
        .optional(),

    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least 1 number'),
});

export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;

/**
 * Login Validation Schema
 * POST /v1/auth/login
 */
export const loginSchema = z.object({
    identifier: z
        .string()
        .min(1, 'Email or phone is required'),

    password: z
        .string()
        .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Refresh Token Validation Schema
 * POST /v1/auth/refresh
 */
export const refreshTokenSchema = z.object({
    refreshToken: z
        .string()
        .min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/**
 * Logout Validation Schema
 * POST /v1/auth/logout
 */
export const logoutSchema = z.object({
    refreshToken: z
        .string()
        .min(1, 'Refresh token is required')
        .optional(),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

/**
 * Request OTP Validation Schema
 * POST /v1/auth/request-otp
 */
export const requestOtpSchema = z.object({
    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

/**
 * Verify OTP Validation Schema
 * POST /v1/auth/verify-otp
 */
export const verifyOtpSchema = z.object({
    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    otp: z
        .string()
        .length(6, 'OTP must be exactly 6 digits')
        .regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * Forgot Password Validation Schema
 * POST /v1/auth/forgot-password
 */
export const forgotPasswordSchema = z.object({
    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset Password Validation Schema
 * POST /v1/auth/reset-password
 */
export const resetPasswordSchema = z.object({
    phone: z
        .string()
        .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    otp: z
        .string()
        .length(6, 'OTP must be exactly 6 digits')
        .regex(/^\d{6}$/, 'OTP must be 6 digits'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least 1 number'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
