const LOCAL_SITE_FALLBACK = "http://localhost:3000";

function normalizeOrigin(url: string | undefined, fallback: string): string {
  const value = (url ?? "").trim();
  if (!value) return fallback;

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

function deriveCookieDomain(siteUrl: string): string {
  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase();

    // Skip cookie domain for localhost/IP hosts.
    if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return "";
    }

    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "";
  }
}

export const SITE_URL = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL, LOCAL_SITE_FALLBACK);
export const SELLER_PORTAL_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_SELLER_PORTAL_URL,
  SITE_URL
);

/* ── KTMONA company details ─────────────────────────────────────────────── */
export const BRAND_NAME = "KTMONA";
export const BRAND_TAGLINE = "Trust Every Click";
export const BRAND_FULL_FORM = "Knowledge, Trust & More Online Network Access";
export const COMPANY_ADDRESS = "A-740, Vinay Nagar, Agwanpur, Faridabad, Haryana 121013, India";
export const COMPANY_ADDRESS_LINES = [
  "KTMONA",
  "A-740, Vinay Nagar, Agwanpur",
  "Faridabad, Haryana 121013",
  "India",
] as const;

const DEFAULT_CONTACT_EMAIL = "monika99skb@gmail.com";

export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? DEFAULT_CONTACT_EMAIL)
  .trim();
export const ONBOARDING_EMAIL = (process.env.NEXT_PUBLIC_ONBOARDING_EMAIL ?? DEFAULT_CONTACT_EMAIL)
  .trim();
export const REFUND_EMAIL = (process.env.NEXT_PUBLIC_REFUND_EMAIL ?? DEFAULT_CONTACT_EMAIL)
  .trim();
export const SELLER_SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SELLER_SUPPORT_EMAIL ?? DEFAULT_CONTACT_EMAIL)
  .trim();
export const PARTNERSHIP_EMAIL = (process.env.NEXT_PUBLIC_PARTNERSHIP_EMAIL ?? DEFAULT_CONTACT_EMAIL)
  .trim();
export const SUPPORT_PHONE_DISPLAY = (process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY ?? "+91-8766211837")
  .trim();
export const SUPPORT_PHONE_DIAL = (process.env.NEXT_PUBLIC_SUPPORT_PHONE_DIAL ?? "+918766211837")
  .trim();

const explicitCookieDomain = (process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? "")
  .trim()
  .replace(/^\./, "");

const effectiveCookieDomain = explicitCookieDomain || deriveCookieDomain(SITE_URL);

/**
 * Base domain the session cookies are shared across (no leading dot), or "" to
 * write host-only cookies. `lib/cookie.ts` composes the attributes at write
 * time so `Secure` can track the page's actual protocol.
 */
export const COOKIE_DOMAIN = effectiveCookieDomain;

export const COOKIE_ATTRIBUTES_SUFFIX =
  process.env.NODE_ENV === "production"
    ? `${effectiveCookieDomain ? `; domain=.${effectiveCookieDomain}` : ""}; SameSite=Lax; Secure`
    : "";

/**
 * Same as COOKIE_ATTRIBUTES_SUFFIX but WITHOUT the `domain=` attribute, so the
 * cookie is scoped to the exact current host. Used as a fallback when the
 * domain-scoped cookie is rejected by the browser (host/domain mismatch), which
 * otherwise silently drops the session and loops the user back to login.
 */
export const COOKIE_ATTRIBUTES_SUFFIX_HOST_ONLY =
  process.env.NODE_ENV === "production" ? "; SameSite=Lax; Secure" : "";
