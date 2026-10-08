import { jwtDecode } from "jwt-decode";
import {
  getAccessToken,
  loadSession,
  updateTokens,
  clearSession,
} from "../storage/auth";

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const PROD_BASE_URL_RAW =
  process.env.BACKEND_URL?.trim() ||
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  "https://api.ktmona.com";

const LOCAL_BASE_URL_RAW =
  process.env.LOCAL_BACKEND_URL?.trim() ||
  process.env.EXPO_PUBLIC_LOCAL_BACKEND_URL?.trim() ||
  "http://localhost:5005";

export const PRODUCTION_API_BASE_URL = PROD_BASE_URL_RAW.replace(/\/+$/, "");
export const LOCAL_API_BASE_URL = LOCAL_BASE_URL_RAW.replace(/\/+$/, "");
const USE_LOCAL_API_IN_DEV =
  envFlagEnabled(process.env.USE_LOCAL_BACKEND) ||
  envFlagEnabled(process.env.EXPO_PUBLIC_USE_LOCAL_BACKEND);

const RAW_BASE_URL =
  __DEV__ && USE_LOCAL_API_IN_DEV ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL;

/** Base URL with any trailing slashes stripped. */
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

function shouldFallbackToProduction(error: unknown, baseUrl: string): boolean {
  if (!__DEV__) return false;
  if (baseUrl.replace(/\/+$/, "") === PRODUCTION_API_BASE_URL) return false;
  return error instanceof ApiError && error.isNetworkError;
}

if (__DEV__) {
  // Helps verify whether app is currently pointed to local or production API.
  console.log("[mobile-api] base", {
    apiBaseUrl: API_BASE_URL,
    localBaseUrl: LOCAL_API_BASE_URL,
    productionBaseUrl: PRODUCTION_API_BASE_URL,
    useLocalApiInDev: USE_LOCAL_API_IN_DEV,
  });
}

// ---------------------------------------------------------------------------
// Session-expired callback (registered by AuthProvider on mount)
// ---------------------------------------------------------------------------
let sessionExpiredHandler: (() => void) | null = null;

/** Called by AuthProvider to receive forced-logout events. */
export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

export function triggerSessionExpired() {
  sessionExpiredHandler?.();
}

// ---------------------------------------------------------------------------
// Centralized API error
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }

  get isNetworkError() {
    return this.statusCode === 0;
  }
}

// ---------------------------------------------------------------------------
// Refresh-token mutex — ensures only one concurrent refresh request
// ---------------------------------------------------------------------------
let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const session = await loadSession();
      if (!session?.refreshToken) return null;

      // Direct fetch avoids re-entering apiRequest (would loop on 401)
      const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!res.ok) return null;

      const body = await res.json().catch(() => null);
      if (!body?.accessToken || !body?.refreshToken) return null;

      await updateTokens(body.accessToken, body.refreshToken);
      return body.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// In-flight GET deduplication
// ---------------------------------------------------------------------------

/** Seconds before expiry at which we proactively refresh. */
const REFRESH_THRESHOLD_SECONDS = 60;

/**
 * Decode a JWT and return `true` when the token will expire within
 * `REFRESH_THRESHOLD_SECONDS` (default 60 s).  Returns `false` for
 * invalid / unparseable tokens so the normal 401 fallback can handle it.
 */
function isTokenExpiringSoon(token: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (typeof exp !== "number") return false;
    return exp < Date.now() / 1000 + REFRESH_THRESHOLD_SECONDS;
  } catch {
    return false;
  }
}
const inFlight = new Map<string, Promise<unknown>>();

/** Build a dedup key from method + path (ignores body). */
function dedupKey(method: string, path: string): string | null {
  if (method.toUpperCase() !== "GET") return null;
  return `GET:${path}`;
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------
type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  /** Pass an AbortSignal for cancellation (e.g. on unmount). */
  signal?: AbortSignal;
  /** @internal single-retry guard */
  _retry?: boolean;
  /** Skip in-flight dedup (e.g. for forced refresh). */
  _skipDedup?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, token, signal, _retry, _skipDedup, headers, ...rest } =
    options;

  // ---- Dedup: return existing promise for identical in-flight GETs ----
  const method = ((rest.method as string) ?? "GET").toUpperCase();
  const key = _skipDedup ? null : dedupKey(method, path);

  if (key && inFlight.has(key)) {
    return inFlight.get(key) as Promise<T>;
  }

  const execute = async (): Promise<T> => {
    let authToken = token ?? (await getAccessToken());

    // ---- Proactive refresh: if the token is about to expire, refresh now ----
    if (authToken && !_retry && isTokenExpiringSoon(authToken)) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) authToken = refreshed;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          Accept: "application/json",
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...((headers as Record<string, string>) ?? {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
        ...rest,
      });
    } catch (err) {
      // AbortError should propagate as-is so callers can distinguish cancellation
      if (isAbortError(err)) {
        throw err;
      }
      // Network-level failure (no internet, DNS, timeout …)
      throw new ApiError(
        0,
        err instanceof Error ? err.message : "Network request failed"
      );
    }

    // ---- 401 interception: single retry via refresh token ----
    if (response.status === 401 && !_retry) {
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        return apiRequest<T>(path, {
          ...options,
          token: newToken,
          _retry: true,
          _skipDedup: true,
        });
      }

      const hasAuthContext = Boolean(authToken);
      // Refresh also failed → force sign-out only when we had a session
      if (hasAuthContext) {
        await clearSession();
        sessionExpiredHandler?.();
      }

      throw new ApiError(
        401,
        hasAuthContext ? "Session expired. Please sign in again." : "Unauthorized."
      );
    }

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const msg =
        (data as any)?.error?.message ??
        (data as any)?.message ??
        "Request failed";
      const details = (data as any)?.error?.details;
      throw new ApiError(response.status, msg, details);
    }

    return data as T;
  };

  const promise = execute().catch(async (error) => {
    if (!shouldFallbackToProduction(error, API_BASE_URL)) {
      throw error;
    }

    if (__DEV__) {
      console.warn("[mobile-api] local request failed, retrying on production", {
        path,
        localBase: API_BASE_URL,
        productionBase: PRODUCTION_API_BASE_URL,
      });
    }

    const authToken = token ?? (await getAccessToken());
    const response = await fetch(`${PRODUCTION_API_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...((headers as Record<string, string>) ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      ...rest,
    });

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const msg =
        (data as any)?.error?.message ??
        (data as any)?.message ??
        "Request failed";
      const details = (data as any)?.error?.details;
      throw new ApiError(response.status, msg, details);
    }

    return data as T;
  }).finally(() => {
    if (key) inFlight.delete(key);
  });

  if (key) inFlight.set(key, promise);

  return promise;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Abort in-flight GETs and clear the dedup map.
 * Called during hard logout so stale requests don't
 * write back into state after the user signs out.
 */
export function clearInFlightRequests(): void {
  inFlight.clear();
}

/**
 * Reset the refresh-token mutex so a subsequent login
 * starts with a clean slate (no dangling promise from the
 * previous session).
 */
export function resetRefreshMutex(): void {
  refreshPromise = null;
}

// ---------------------------------------------------------------------------
// Helper: check if an error is an AbortError (cancelled request)
// ---------------------------------------------------------------------------
export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    return err.name === "AbortError" || err.message.includes("AbortError");
  }
  const maybe = err as { name?: string } | null;
  return maybe?.name === "AbortError";
}
