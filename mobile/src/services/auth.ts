import { apiRequest } from "./apiClient";

// ---------------------------------------------------------------------------
// Types — mirrors backend auth contracts exactly
// ---------------------------------------------------------------------------

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterUserPayload {
  fullName: string;
  email: string;
  /** Optional: the OTP is sent to the email address. */
  phone?: string;
  password: string;
  /** Friend's referral code. */
  referralCode?: string;
}

export interface AuthUser {
  id: string;
  fullName?: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/** Where an OTP went: send this back with the code to verify it. */
export type OtpVerifyWith = { email: string } | { phone: string };

export interface RegisterResponse {
  message: string;
  verifyWith?: OtpVerifyWith;
}

export interface MessageResponse {
  message: string;
}

export interface OtpSentResponse {
  message: string;
  verifyWith?: OtpVerifyWith;
}

/** POST /v1/auth/request-otp body */
export interface RequestOtpPayload {
  /** Email address or mobile number of the account. */
  identifier: string;
}

/** POST /v1/auth/verify-otp body (`phone` or `email`, as given in verifyWith) */
export interface VerifyOtpPayload {
  phone?: string;
  email?: string;
  otp: string;
}

/**
 * verify-otp returns EITHER a full LoginResponse (with tokens)
 * or just a MessageResponse (e.g. "Seller approval pending").
 * We discriminate by the presence of `accessToken`.
 */
export type VerifyOtpResponse = LoginResponse | MessageResponse;

export function isLoginResponse(res: VerifyOtpResponse): res is LoginResponse {
  return "accessToken" in res && typeof (res as LoginResponse).accessToken === "string";
}

// ---------------------------------------------------------------------------
// BUYER-ONLY role enforcement constant
// ---------------------------------------------------------------------------
export const ALLOWED_ROLE = "USER" as const;

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** POST /v1/auth/login */
export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>({
    url: "/v1/auth/login",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/register */
export async function registerUser(
  payload: RegisterUserPayload
): Promise<RegisterResponse> {
  console.info("[mobile-auth][register-user] request", {
    email: payload.email,
    phone: payload.phone ? "[present]" : "[missing]",
  });
  return apiRequest<RegisterResponse>({
    url: "/v1/auth/register",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/request-otp */
export async function requestOtp(
  payload: RequestOtpPayload
): Promise<OtpSentResponse> {
  console.info("[mobile-auth][request-otp] request");
  return apiRequest<OtpSentResponse>({
    url: "/v1/auth/request-otp",
    method: "POST",
    data: payload,
  });
}

/**
 * POST /v1/auth/guest-otp — guest checkout. Emails a one-time code (verify with
 * verifyOtp / signInWithOtp). Returning customers get a sign-in code instead.
 */
export async function requestGuestOtp(payload: {
  email: string;
  phone?: string;
  fullName: string;
  referralCode?: string;
}): Promise<OtpSentResponse & { existingAccount: boolean }> {
  return apiRequest<OtpSentResponse & { existingAccount: boolean }>({
    url: "/v1/auth/guest-otp",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/resend-signup-otp — re-send the code for a pending sign-up. */
export async function resendSignupOtp(payload: OtpVerifyWith): Promise<OtpSentResponse> {
  return apiRequest<OtpSentResponse>({
    url: "/v1/auth/resend-signup-otp",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/verify-otp — may return tokens or a message-only response */
export async function verifyOtp(
  payload: VerifyOtpPayload
): Promise<VerifyOtpResponse> {
  console.info("[mobile-auth][verify-otp] request", {
    via: payload.email ? "email" : "phone",
    otpLength: payload.otp.length,
  });
  return apiRequest<VerifyOtpResponse>({
    url: "/v1/auth/verify-otp",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/logout — best-effort, server-side session revoke */
export async function logoutUser(
  refreshToken: string,
  accessToken: string
): Promise<void> {
  try {
    await apiRequest<MessageResponse>({
      url: "/v1/auth/logout",
      method: "POST",
      data: { refreshToken },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Best-effort — if server is unreachable we still clear locally
  }
}

// ---------------------------------------------------------------------------
// Password Reset
// ---------------------------------------------------------------------------

export interface ForgotPasswordPayload {
  /** Email address or mobile number of the account. */
  identifier: string;
}

export interface ResetPasswordPayload {
  identifier: string;
  otp: string;
  newPassword: string;
}

/** POST /v1/auth/forgot-password */
export async function forgotPassword(
  payload: ForgotPasswordPayload
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>({
    url: "/v1/auth/forgot-password",
    method: "POST",
    data: payload,
  });
}

/** POST /v1/auth/reset-password */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>({
    url: "/v1/auth/reset-password",
    method: "POST",
    data: payload,
  });
}
