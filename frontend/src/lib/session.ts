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

import { clearSessionCookie, setSessionCookie } from "@/lib/cookie";

/**
 * PORTAL-SCOPED SESSIONS.
 *
 * The storefront, seller panel and admin panel each keep their own session
 * under their own cookie names, so one browser can be signed in to all three
 * at once. They used to share one set of names: signing in to the seller panel
 * overwrote the admin session, and the next admin page saw a SELLER role on
 * the admin subdomain and wiped every cookie — logging the user out of both.
 *
 * The buyer portal keeps the original names so existing buyer sessions survive.
 */
export type Portal = "user" | "seller" | "admin";

export interface SessionCookieNames {
  access: string;
  refresh: string;
  role: string;
  user: string;
}

const LEGACY_COOKIE_NAMES: SessionCookieNames = {
  access: "ktmona_access",
  refresh: "ktmona_refresh",
  role: "ktmona_role",
  user: "ktmona_user",
};

/**
 * Cookie lifetime: one year, renewed on every token refresh. Buyer and seller
 * sessions stay signed in until a manual logout (the server's refresh token is
 * long-lived and sliding); whether a token is still valid is read from its own
 * `exp`, never from the cookie's age.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Cookie names holding the session for `portal`. */
export function sessionCookieNames(portal: Portal): SessionCookieNames {
  if (portal === "user") return LEGACY_COOKIE_NAMES;
  return {
    access: `ktmona_${portal}_access`,
    refresh: `ktmona_${portal}_refresh`,
    role: `ktmona_${portal}_role`,
    user: `ktmona_${portal}_user`,
  };
}

/** The portal whose session a role signs in to. */
export function portalForRole(role: string | null | undefined): Portal {
  const normalized = role?.toUpperCase();
  if (normalized === "SELLER") return "seller";
  if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "admin";
  return "user";
}

/**
 * The portal a URL belongs to: the subdomain in production, the path prefix
 * on hosts without subdomains (localhost, preview URLs).
 */
export function portalForLocation(hostname: string, pathname: string): Portal {
  if (hostname.startsWith("admin.")) return "admin";
  if (hostname.startsWith("seller.")) return "seller";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/seller" || pathname.startsWith("/seller/")) return "seller";
  return "user";
}

/** The portal of the page currently open in this browser tab. */
export function currentPortal(): Portal {
  if (typeof window === "undefined") return "user";
  return portalForLocation(window.location.hostname, window.location.pathname);
}

/**
 * Read a portal's session through a cookie getter (proxy / server components).
 *
 * Staff sessions created before cookies were portal-scoped still live under
 * the legacy names; they are honoured for the matching portal until the client
 * moves them (see `migrateLegacyStaffSession`). A staff role found under the
 * legacy names never counts as a buyer session.
 */
export function readPortalSession(
  get: (name: string) => string | undefined,
  portal: Portal
): { access?: string; refresh?: string; role?: string } {
  const names = sessionCookieNames(portal);
  const own = {
    access: get(names.access) || undefined,
    refresh: get(names.refresh) || undefined,
    role: get(names.role)?.toUpperCase() || undefined,
  };

  if (portal !== "user") {
    if (own.access || own.refresh) return own;
    const legacyRole = get(LEGACY_COOKIE_NAMES.role)?.toUpperCase();
    if (legacyRole && portalForRole(legacyRole) === portal) {
      return {
        access: get(LEGACY_COOKIE_NAMES.access) || undefined,
        refresh: get(LEGACY_COOKIE_NAMES.refresh) || undefined,
        role: legacyRole,
      };
    }
    return own;
  }

  if (own.role && portalForRole(own.role) !== "user") return {};
  return own;
}

let legacyMigrationDone = false;

/**
 * Move a staff session stored under the legacy (shared) names into its own
 * portal's names, once per page load, so it stops occupying the buyer slot.
 */
function migrateLegacyStaffSession(): void {
  if (legacyMigrationDone || typeof document === "undefined") return;
  legacyMigrationDone = true;

  const legacyRole = readCookieValues(LEGACY_COOKIE_NAMES.role).at(-1)?.toUpperCase();
  const target = portalForRole(legacyRole);
  if (!legacyRole || target === "user") return;

  const names = sessionCookieNames(target);
  const alreadyHasSession =
    readRawCookieValues(names.access).length > 0 ||
    readRawCookieValues(names.refresh).length > 0;

  if (!alreadyHasSession) {
    for (const key of ["access", "refresh", "role", "user"] as const) {
      const value = readRawCookieValues(LEGACY_COOKIE_NAMES[key]).at(-1);
      if (value) setSessionCookie(names[key], value, SESSION_COOKIE_MAX_AGE_SECONDS);
    }
  }

  for (const key of ["access", "refresh", "role", "user"] as const) {
    clearSessionCookie(LEGACY_COOKIE_NAMES[key]);
  }
}

/** Cookie names for `portal` (default: this tab's portal), after legacy migration. */
function namesFor(portal?: Portal): SessionCookieNames {
  migrateLegacyStaffSession();
  return sessionCookieNames(portal ?? currentPortal());
}

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
export function getAccessToken(portal?: Portal): string | null {
  return pickUsableToken(readCookieValues(namesFor(portal).access));
}

/** The refresh token to spend, preferring one that has not expired. */
export function getRefreshToken(portal?: Portal): string | null {
  return pickUsableToken(readCookieValues(namesFor(portal).refresh));
}

/**
 * Whether the browser holds a session at all.
 *
 * An expired access token with a live refresh token IS a session — the API
 * layer restores it silently. Only the absence of both means "signed out".
 * This is the ONLY function the UI should use to gate protected actions.
 */
export function hasSession(portal?: Portal): boolean {
  const refresh = getRefreshToken(portal);
  if (refresh && !isTokenExpired(refresh)) return true;
  // No usable refresh token: fall back to a live access token.
  const access = getAccessToken(portal);
  return Boolean(access) && !isTokenExpired(access);
}

/** True when we hold a refresh token that is still worth spending. */
export function canRefreshSession(portal?: Portal): boolean {
  const refresh = getRefreshToken(portal);
  return Boolean(refresh) && !isTokenExpired(refresh);
}

/** The role recorded at login, upper-cased, or null. */
export function getSessionRole(portal?: Portal): string | null {
  const role = readCookieValues(namesFor(portal).role).at(-1);
  return role ? role.toUpperCase() : null;
}

/** The user object recorded at login, or null when absent/unparseable. */
export function getSessionUser<T = Record<string, unknown>>(portal?: Portal): T | null {
  for (const value of readCookieValues(namesFor(portal).user).reverse()) {
    try {
      return JSON.parse(value) as T;
    } catch {
      // Try the next candidate — a stale duplicate may be corrupt.
    }
  }
  return null;
}

/** Store a freshly issued session under its role's portal. Returns false when the browser refused the cookie. */
export function writePortalSession(
  accessToken: string,
  refreshToken: string,
  user: { role: string; [key: string]: unknown }
): boolean {
  const names = sessionCookieNames(portalForRole(user.role));
  const stored = setSessionCookie(names.access, accessToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  setSessionCookie(names.refresh, refreshToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  setSessionCookie(names.role, user.role, SESSION_COOKIE_MAX_AGE_SECONDS);
  setSessionCookie(
    names.user,
    encodeURIComponent(JSON.stringify(user)),
    SESSION_COOKIE_MAX_AGE_SECONDS
  );
  return stored;
}

/**
 * Store rotated tokens for `portal`, and re-stamp its role/user cookies so the
 * whole set keeps one lifetime. Without the re-stamp the role cookie expired 7
 * days after sign-in even while refreshes kept the tokens alive, and the proxy
 * then treated the user as signed out.
 */
export function writeRefreshedTokens(
  portal: Portal,
  accessToken: string,
  refreshToken?: string
): void {
  const names = sessionCookieNames(portal);
  setSessionCookie(names.access, accessToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  if (refreshToken) {
    setSessionCookie(names.refresh, refreshToken, SESSION_COOKIE_MAX_AGE_SECONDS);
  }
  for (const name of [names.role, names.user]) {
    const value = readRawCookieValues(name).at(-1);
    if (value) setSessionCookie(name, value, SESSION_COOKIE_MAX_AGE_SECONDS);
  }
}

/** Sign `portal` (default: this tab's portal) out, leaving other portals' sessions alone. */
export function clearPortalSession(portal?: Portal): void {
  if (typeof document === "undefined") return;
  const names = sessionCookieNames(portal ?? currentPortal());
  clearSessionCookie(names.access);
  clearSessionCookie(names.refresh);
  clearSessionCookie(names.role);
  clearSessionCookie(names.user);
  window.dispatchEvent(new Event("ktmona-auth"));
}
