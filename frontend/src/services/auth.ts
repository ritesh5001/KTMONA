import { setSessionCookie, clearSessionCookie } from "@/lib/cookie";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ROLE_COOKIE,
  USER_COOKIE,
} from "@/lib/session";

/**
 * Lifetime for every session cookie, matched to the refresh token's 7 days so
 * the cookies never expire out of step with each other. Token validity is a
 * property of the JWT, not of how long we kept the cookie.
 */
const SESSION_COOKIE_MAX_AGE_SECONDS = 604800;

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterUserPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterSellerPayload {
  email: string;
  phone: string;
  whatsappNumber: string;
  password: string;
}

export interface RegisterAdminPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  department?: string;
  designation?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
}

type ApiErrorResponse = {
  error?: {
    message?: string;
    details?: Record<string, string>;
  };
  message?: string;
};

function buildApiError(data: ApiErrorResponse | null, fallback: string): Error {
  const message =
    data?.error?.message ??
    data?.message ??
    fallback;
  const details = data?.error?.details;

  if (details && Object.keys(details).length > 0) {
    const detailText = Object.values(details).join(" ");
    return new Error(detailText || message);
  }

  return new Error(message);
}

export interface OtpRequestResponse {
  message: string;
}

export interface VerifyOtpResponse {
  message?: string;
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
  };
  accessToken?: string;
  refreshToken?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function clearAuthSession(): void {
  if (typeof document === "undefined") return;
  clearSessionCookie(ACCESS_COOKIE);
  clearSessionCookie(REFRESH_COOKIE);
  clearSessionCookie(ROLE_COOKIE);
  clearSessionCookie(USER_COOKIE);
  window.dispatchEvent(new Event("ktmona-auth"));
}

/**
 * Store all auth cookies after a successful login / token refresh.
 * Uses setSessionCookie so a domain-scoped write that the browser rejects
 * falls back to a host-only cookie (prevents the "logged in but bounced to
 * login" loop on a domain mismatch).
 */
export function persistAuthCookies(
  accessToken: string,
  refreshToken: string,
  user: { role: string;[key: string]: unknown }
): void {
  // All four share one lifetime. When the access cookie expired a day before
  // the others, the browser was left holding half a session and the app
  // disagreed with itself about whether the user was signed in.
  const stored = setSessionCookie(
    ACCESS_COOKIE,
    accessToken,
    SESSION_COOKIE_MAX_AGE_SECONDS
  );
  setSessionCookie(REFRESH_COOKIE, refreshToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  setSessionCookie(ROLE_COOKIE, user.role, SESSION_COOKIE_MAX_AGE_SECONDS);
  setSessionCookie(
    USER_COOKIE,
    encodeURIComponent(JSON.stringify(user)),
    SESSION_COOKIE_MAX_AGE_SECONDS
  );
  window.dispatchEvent(new Event("ktmona-auth"));

  if (!stored) {
    // The browser refused every cookie variant, so the session cannot survive
    // this navigation. Say so loudly: silently continuing is what produced a
    // login that "worked" and then asked for a login again, forever.
    throw new Error(
      "Your browser blocked the sign-in cookie, so the session could not be saved. " +
        "Please allow cookies for this site (and disable private/tracking blocking) and try again."
    );
  }
}

export function signOut(redirectTo: string = "/login?force=1"): void {
  if (typeof window === "undefined") return;
  clearAuthSession();
  // Full redirect ensures middleware + layouts pick up logged-out state everywhere.
  window.location.assign(redirectTo);
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  console.info("[auth-api][login] request", {
    identifier: payload.identifier.substring(0, 3) + "***", // Mask for security
  });

  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.error?.message ?? data?.message ?? "Login failed";
    console.error("[auth-api][login] error", {
      statusCode: response.status,
      message: errorMessage,
      details: data?.error?.details,
    });
    const err = new Error(errorMessage) as Error & { phone?: string; statusCode?: number };
    err.phone = (data?.error?.details?.phone as string | undefined) ?? undefined;
    err.statusCode = response.status;
    throw err;
  }

  console.info("[auth-api][login] success", { role: data?.user?.role });
  return data as LoginResponse;
}

export async function registerUser(
  payload: RegisterUserPayload
): Promise<RegisterResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  console.debug("[auth][register-user] request", {
    email: payload.email,
    phone: payload.phone ? "[present]" : "[missing]",
  });

  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.warn("[auth][register-user] failed", { status: response.status, data });
    throw buildApiError(data as ApiErrorResponse | null, "Registration failed");
  }

  console.info("[auth][register-user] success", { email: payload.email });

  return data as RegisterResponse;
}

export async function registerSeller(
  payload: RegisterSellerPayload
): Promise<RegisterResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  console.debug("[auth][register-seller] request", {
    email: payload.email,
    phone: payload.phone ? "[present]" : "[missing]",
    whatsappNumber: payload.whatsappNumber ? "[present]" : "[missing]",
  });

  const response = await fetch(`${API_BASE_URL}/v1/seller/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.warn("[auth][register-seller] failed", { status: response.status, data });
    throw buildApiError(data as ApiErrorResponse | null, "Seller registration failed");
  }

  console.info("[auth][register-seller] success", { email: payload.email });

  return data as RegisterResponse;
}

export async function registerAdmin(
  payload: RegisterAdminPayload
): Promise<RegisterResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}/v1/auth/admin/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw buildApiError(data as ApiErrorResponse | null, "Admin registration failed");
  }

  return data as RegisterResponse;
}

export interface RequestAuthOtpPayload {
  phone: string;
}

export interface VerifyAuthOtpPayload {
  phone: string;
  otp: string;
}

export async function requestAuthOtp(payload: RequestAuthOtpPayload): Promise<OtpRequestResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  console.debug("[auth][request-otp] request", {
    phone: payload.phone ? "[present]" : undefined,
  });

  const response = await fetch(`${API_BASE_URL}/v1/auth/request-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ?? data?.message ?? "OTP request failed";
    console.warn("[auth][request-otp] failed", { status: response.status, data });
    throw new Error(message);
  }

  console.info("[auth][request-otp] success", { phone: payload.phone ? "[present]" : undefined });

  return data as OtpRequestResponse;
}

export async function verifyAuthOtp(payload: VerifyAuthOtpPayload): Promise<VerifyOtpResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  console.debug("[auth][verify-otp] request", {
    phone: payload.phone ? "[present]" : undefined,
    otpLength: payload.otp?.length,
  });

  const response = await fetch(`${API_BASE_URL}/v1/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ?? data?.message ?? "OTP verification failed";
    console.warn("[auth][verify-otp] failed", { status: response.status, data });
    throw new Error(message);
  }

  console.info("[auth][verify-otp] success", { phone: payload.phone ? "[present]" : undefined });

  return data as VerifyOtpResponse;
}

// ---------------------------------------------------------------------------
// Password Reset
// ---------------------------------------------------------------------------

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordPayload {
  phone: string;
  otp: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

/** POST /v1/auth/forgot-password */
export async function forgotPassword(
  phone: string
): Promise<ForgotPasswordResponse> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured");

  const response = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? data?.message ?? "Request failed"
    );
  }
  return data as ForgotPasswordResponse;
}

/** POST /v1/auth/reset-password */
export async function resetPassword(
  payload: ResetPasswordPayload
): Promise<ResetPasswordResponse> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured");

  const response = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? data?.message ?? "Password reset failed"
    );
  }
  return data as ResetPasswordResponse;
}
