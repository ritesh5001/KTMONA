import { apiRequest, CHECKOUT_REQUEST_TIMEOUT_MS } from "@/services/api";

/**
 * Shiprocket Checkout (Fastrr) — the express checkout.
 *
 * Fastrr hosts the address and payment steps in an overlay, so the storefront's
 * whole job is: get a token, open the overlay, and afterwards ask what happened.
 * Nothing about the buyer's address or payment ever passes through here.
 */

export interface FastrrSession {
  token: string;
  expiresAt: string;
  fastrrOrderId: string;
  sessionId: string;
  /** Fastrr's checkout bundle. Served from their CDN, matched to the API env. */
  scriptUrl: string;
  styleUrl: string;
  redirectUrl: string;
  /** Native checkout, used if their bundle never loads. */
  fallbackUrl: string;
}

export interface FastrrSessionStatus {
  status: "COMPLETED" | "PENDING" | "FAILED" | "UNKNOWN_SESSION";
  orderId: string | null;
  message: string;
}

export interface CheckoutConfig {
  provider: "FASTRR" | "NATIVE";
}

/**
 * Which checkout to render. Decided server-side so the switch reaches every
 * client at once — including a buyer already sitting on the page.
 */
export async function getCheckoutConfig(): Promise<CheckoutConfig> {
  return apiRequest<CheckoutConfig>("/v1/config/checkout", { method: "GET" });
}

/**
 * Mint a Fastrr access token for the buyer's cart or buy-now selection.
 *
 * Given a long timeout on purpose: this validates the cart and makes a
 * round-trip to Shiprocket, and giving up early would strand a session that
 * their side has already created.
 */
export async function createFastrrSession(input: {
  variantIds?: string[];
  couponCode?: string;
  mobileApp?: boolean;
}): Promise<FastrrSession> {
  return apiRequest<FastrrSession>("/v1/fastrr/checkout/token", {
    method: "POST",
    body: input,
    timeoutMs: CHECKOUT_REQUEST_TIMEOUT_MS,
  });
}

/**
 * How the checkout ended.
 *
 * The backend does not merely read a cached row — it asks Fastrr directly and
 * places the order on the spot if it is paid. That is why the callback page can
 * show a real order id without waiting for the webhook to arrive.
 */
export async function getFastrrSessionStatus(
  sessionId: string
): Promise<FastrrSessionStatus> {
  return apiRequest<FastrrSessionStatus>(
    `/v1/fastrr/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET", timeoutMs: CHECKOUT_REQUEST_TIMEOUT_MS }
  );
}

// ---------------------------------------------------------------------------
// The Fastrr browser bundle
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    HeadlessCheckout?: {
      addToCart: (
        event: unknown,
        token: string,
        options: { fallbackUrl: string; isInitiatedFromApp?: boolean }
      ) => void;
    };
  }
}

const loaded = new Set<string>();

/**
 * Load Fastrr's stylesheet and script once per page.
 *
 * The URLs come from the server rather than being hardcoded so the staging and
 * production bundles can never be mismatched against the API that minted the
 * token — a prod token handed to the staging bundle simply fails.
 */
export async function loadFastrrCheckout(session: {
  scriptUrl: string;
  styleUrl: string;
}): Promise<void> {
  if (typeof window === "undefined") return;

  if (!loaded.has(session.styleUrl)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = session.styleUrl;
    document.head.appendChild(link);
    loaded.add(session.styleUrl);
  }

  if (window.HeadlessCheckout) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${session.scriptUrl}"]`
    );
    if (existing) {
      // A second click while the first load is still in flight.
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Express checkout failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = session.scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Express checkout failed to load"));
    document.body.appendChild(script);
  });

  if (!window.HeadlessCheckout) {
    throw new Error("Express checkout failed to load");
  }
}
