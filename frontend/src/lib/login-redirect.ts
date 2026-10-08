/**
 * Build a login URL that remembers where the user was, so a buyer who is
 * bounced to sign in from a product, cart, or wishlist action is returned to
 * that same page afterwards.
 *
 * The current path+query is captured as a `redirect` param; the login page
 * validates and consumes it (see getBuyerRedirect in the login page).
 */
export function loginUrlWithReturn(force = true): string {
  const base = force ? "/login?force=1" : "/login";
  if (typeof window === "undefined") return base;

  const current = window.location.pathname + window.location.search;
  // Don't capture auth pages as a return target.
  if (current.startsWith("/login") || current.startsWith("/register")) {
    return base;
  }

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}redirect=${encodeURIComponent(current)}`;
}

const AUTH_PATHS = ["/login", "/register", "/verify-otp", "/forgot-password", "/reset-password"];

/**
 * Resolve where a buyer should land after authenticating: the `redirect` query
 * param if it is a safe same-origin path, otherwise the homepage. Rejects
 * absolute/protocol-relative URLs (open-redirect guard) and auth pages (so we
 * never loop back into the login flow).
 */
export function buyerReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  // `redirect` is set by our client bounces; `returnTo` by the middleware.
  const raw = params.get("redirect") ?? params.get("returnTo");
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  if (AUTH_PATHS.some((p) => raw === p || raw.startsWith(`${p}?`) || raw.startsWith(`${p}/`))) {
    return "/";
  }
  return raw;
}
