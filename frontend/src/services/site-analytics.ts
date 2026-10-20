import { getAccessToken } from "@/lib/session";

/**
 * Storefront traffic beacon for the admin Analytics page (visitors, seller
 * sign-up attempts, product views). Fire-and-forget: never throws, never
 * shows the navigation progress bar (plain fetch, not apiRequest).
 */

export type SiteEventType = "VISIT" | "SELLER_SIGNUP_VIEW" | "SELLER_SIGNUP_SUBMIT" | "PRODUCT_VIEW";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

const VISITOR_KEY = "ktm_vid";

function visitorId(): string | null {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: not counted
  }
}

/** Each event is stored once per visitor per day; skip repeat calls client-side too. */
function alreadySentToday(key: string): boolean {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const storageKey = `ktm_evt:${key}`;
    if (window.sessionStorage.getItem(storageKey) === day) return true;
    window.sessionStorage.setItem(storageKey, day);
  } catch {
    // ignore
  }
  return false;
}

export function trackSiteEvent(type: SiteEventType, productId?: string) {
  if (typeof window === "undefined" || !API_BASE_URL) return;
  const id = visitorId();
  if (!id) return;
  if (alreadySentToday(productId ? `${type}:${productId}` : type)) return;

  const token = getAccessToken();
  void fetch(`${API_BASE_URL}/v1/analytics/track`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, visitorId: id, ...(productId ? { productId } : {}) }),
  }).catch(() => undefined);
}
