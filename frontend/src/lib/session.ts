/**
 * Single source of truth for "is there a session, and what token do we send?".
 *
 * Before this module, six different places answered that question with six
 * different rules: the middleware accepted `access || refresh`, the cart page
 * demanded `access` only, the header derived "signed in" from the access
 * cookie alone, and the product page accepted either. A state that satisfied
 * one check but not another sent the buyer around the login loop forever —
 * middleware let them onto /cart, the page bounced them to /login, login saw a
 * valid session and bounced them back.
 *
 * Two rules keep that from recurring:
 *
 *  1. Session presence is decided ONLY by `hasSession()` — everywhere.
 *  2. Token *validity* is never inferred from cookie presence. A cookie can
 *     outlive the JWT inside it, so validity is read from the JWT's own `exp`
 *     and a stale token is refreshed rather than treated as "logged out".
 */

export const ACCESS_COOKIE = "ktmona_access";
export const REFRESH_COOKIE = "ktmona_refresh";
export const ROLE_COOKIE = "ktmona_role";
export const USER_COOKIE = "ktmona_user";

/** Treat a token as expired this many seconds early, to cover clock skew and flight time. */
const EXPIRY_SKEW_SECONDS = 30;

/**
 * Every value stored under `name`, most-recently-written last.
 *
 * `document.cookie` can legitimately hold several cookies with the same name at
 * different scopes (one `domain=.example.com`, one host-only for
 * `www.example.com`). A single regex match returns whichever the browser lists
 * first — often the STALE one — so reading a "present" cookie could still yield
 * a dead token. Callers use this to consider all candidates.
 */
export function readCookieValues(name: string): string[] {
  return readRawCookieValues(name).map((raw) => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  });
}

/**
 * Every value stored under `name`, exactly as the browser holds it (no
 * percent-decoding). Writers verify their own writes with this, so a value that
 * was stored pre-encoded still compares equal to what was sent.
 */
export function readRawCookieValues(name: string): string[] {
  if (typeof document === "undefined") return [];
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`, "g");
  const values: string[] = [];
  for (const match of document.cookie.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    values.push(raw);
  }
  return values;
}

/** Decode a JWT payload without verifying it (the server verifies; we only read `exp`). */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

/**
 * True when the token is missing, malformed, or past its `exp`.
 * A token with no `exp` claim is treated as usable — the server decides.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now() + EXPIRY_SKEW_SECONDS * 1000;
}

/**
 * Pick the best token among duplicate cookies: the first one that still has
 * time left, else the last written (so we send *something* and let a 401 drive
 * the refresh, rather than reporting "signed out").
 */
function pickUsableToken(values: string[]): string | null {
  if (values.length === 0) return null;
  const live = values.find((value) => !isTokenExpired(value));
  return live ?? values[values.length - 1] ?? null;
}

/** The access token to send, preferring one that has not expired. */
export function getAccessToken(): string | null {
  return pickUsableToken(readCookieValues(ACCESS_COOKIE));
}

/** The refresh token to spend, preferring one that has not expired. */
export function getRefreshToken(): string | null {
  return pickUsableToken(readCookieValues(REFRESH_COOKIE));
}

/**
 * Whether the browser holds a session at all.
 *
 * An expired access token with a live refresh token IS a session — the API
 * layer restores it silently. Only the absence of both means "signed out".
 * This is the ONLY function the UI should use to gate protected actions.
 */
export function hasSession(): boolean {
  const refresh = getRefreshToken();
  if (refresh && !isTokenExpired(refresh)) return true;
  // No usable refresh token: fall back to a live access token.
  const access = getAccessToken();
  return Boolean(access) && !isTokenExpired(access);
}

/** True when we hold a refresh token that is still worth spending. */
export function canRefreshSession(): boolean {
  const refresh = getRefreshToken();
  return Boolean(refresh) && !isTokenExpired(refresh);
}

/** The role recorded at login, upper-cased, or null. */
export function getSessionRole(): string | null {
  const role = readCookieValues(ROLE_COOKIE).at(-1);
  return role ? role.toUpperCase() : null;
}

/** The user object recorded at login, or null when absent/unparseable. */
export function getSessionUser<T = Record<string, unknown>>(): T | null {
  for (const value of readCookieValues(USER_COOKIE).reverse()) {
    try {
      return JSON.parse(value) as T;
    } catch {
      // Try the next candidate — a stale duplicate may be corrupt.
    }
  }
  return null;
}
