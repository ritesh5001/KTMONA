import { COOKIE_DOMAIN } from "@/lib/site-config";
import { readRawCookieValues } from "@/lib/session";

/**
 * Session-cookie plumbing.
 *
 * Two failure modes here previously logged buyers out and looped them back to
 * the login page, and both are guarded against below.
 *
 * 1. DROPPED WRITES. Cookies are scoped to `.<domain>` so they are shared with
 *    the seller/admin subdomains. When that domain does not match the host the
 *    app is served from (env mismatch, preview URL, apex vs www, an IP), the
 *    browser silently discards the cookie — the session looks absent the moment
 *    the next page reads it. A `Secure` cookie on a plain-HTTP host is dropped
 *    the same silent way. So the write is verified and retried host-only, and
 *    `Secure` is only attached when the page is actually on HTTPS.
 *
 * 2. SHADOWED WRITES. If a cookie of the same name already exists at a
 *    different scope, writing the other scope leaves TWO cookies with that
 *    name. `document.cookie` may list the stale one first, so the app keeps
 *    reading a dead token while believing it just stored a fresh one — an
 *    unrecoverable loop, because every login "succeeds" and every request still
 *    401s. Every write therefore removes both scopes first, and the write is
 *    verified by comparing the VALUE that came back, not merely its presence.
 */

/** `SameSite`/`Secure` attributes, with `Secure` omitted on non-HTTPS origins. */
function securityAttributes(): string {
  if (typeof document === "undefined") return "";
  // `location.protocol` is the only reliable signal: NODE_ENV says nothing
  // about how this particular page was served.
  const isSecureContext = window.location.protocol === "https:";
  return isSecureContext ? "; SameSite=Lax; Secure" : "; SameSite=Lax";
}

/** Attributes for the domain-scoped write (shared across subdomains). */
function domainAttributes(): string {
  return COOKIE_DOMAIN ? `; domain=.${COOKIE_DOMAIN}` : "";
}

/** Remove `name` at BOTH the domain-scoped and host-only scopes. */
function deleteBothScopes(name: string): void {
  if (typeof document === "undefined") return;
  const security = securityAttributes();
  document.cookie = `${name}=; path=/; max-age=0${domainAttributes()}${security}`;
  document.cookie = `${name}=; path=/; max-age=0${security}`;
}

/**
 * Store a session cookie so that it is actually readable afterwards.
 *
 * Returns true when the value could be read back, false when the browser
 * refused every variant — the caller can then surface a real error instead of
 * bouncing the user into a login loop that cannot resolve.
 */
export function setSessionCookie(
  name: string,
  value: string,
  maxAgeSeconds: number
): boolean {
  if (typeof document === "undefined") return false;

  // Clear both scopes first so this write cannot be shadowed by a stale
  // duplicate at the other scope.
  deleteBothScopes(name);

  const security = securityAttributes();
  const base = `${name}=${value}; path=/; max-age=${maxAgeSeconds}`;

  document.cookie = `${base}${domainAttributes()}${security}`;
  if (readRawCookieValues(name).includes(value)) return true;

  // Domain-scoped write was rejected — retry scoped to the exact host, which
  // the browser always accepts for the origin that set it.
  document.cookie = `${base}${security}`;
  return readRawCookieValues(name).includes(value);
}

/**
 * Read a cookie's value, preferring the most recently written when duplicates
 * exist at different scopes. Token reads should use the helpers in
 * `lib/session.ts`, which additionally skip expired duplicates.
 */
export function readCookie(name: string): string | null {
  const values = readRawCookieValues(name).at(-1);
  if (values === undefined) return null;
  try {
    return decodeURIComponent(values);
  } catch {
    return values;
  }
}

/** Clear a cookie across BOTH domain-scoped and host-only variants. */
export function clearSessionCookie(name: string): void {
  deleteBothScopes(name);
}
