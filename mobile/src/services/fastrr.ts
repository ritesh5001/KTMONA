import { apiRequest } from "./api";

/**
 * Shiprocket Checkout (Fastrr) — the express checkout.
 *
 * Fastrr's checkout is a browser bundle, so on mobile it runs inside a WebView
 * rather than natively. The app's only jobs are to mint a token with its own
 * authenticated session and to ask afterwards how the checkout ended — the same
 * two calls the web storefront makes.
 */

export interface FastrrSession {
  token: string;
  expiresAt: string;
  fastrrOrderId: string;
  sessionId: string;
  scriptUrl: string;
  styleUrl: string;
  redirectUrl: string;
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
 * Which checkout this build should show.
 *
 * Asked at runtime rather than compiled in, so turning express checkout off
 * reaches app versions already installed on buyers' phones without a release.
 */
export async function getCheckoutConfig(
  token?: string | null,
  signal?: AbortSignal
): Promise<CheckoutConfig> {
  return apiRequest<CheckoutConfig>("/v1/config/checkout", {
    method: "GET",
    token,
    signal,
  });
}

/** Mint a Fastrr access token for the cart, or a single buy-now variant. */
export async function createFastrrSession(
  input: { variantIds?: string[]; couponCode?: string },
  token?: string | null
): Promise<FastrrSession> {
  return apiRequest<FastrrSession>("/v1/fastrr/checkout/token", {
    method: "POST",
    // `mobileApp` tells Fastrr it is rendering inside an app shell, which
    // changes their overlay's chrome and disables redirects the WebView cannot
    // follow back.
    body: { ...input, mobileApp: true },
    token,
  });
}

/**
 * How the checkout ended.
 *
 * The backend asks Fastrr directly and places the order on the spot if it is
 * paid, so this resolves without waiting for the webhook.
 */
export async function getFastrrSessionStatus(
  sessionId: string,
  token?: string | null,
  signal?: AbortSignal
): Promise<FastrrSessionStatus> {
  return apiRequest<FastrrSessionStatus>(
    `/v1/fastrr/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET", token, signal }
  );
}

/**
 * The origin the checkout document is loaded under.
 *
 * This is not cosmetic. Fastrr's bundle identifies the merchant as
 * `#sellerDomain`'s value *or* `window.location.host`, and it keys real
 * behaviour off that — which storefront the session belongs to, and which
 * per-seller feature flags apply. Loading the document under Fastrr's own CDN
 * host told their bundle the seller was `checkout-ui.shiprocket.com`, which is
 * nobody, so the overlay had no store to check out against. The web storefront
 * never hit this because there `location.host` is genuinely the store.
 *
 * The store's own origin is taken from `fallbackUrl`, which the backend already
 * builds from the storefront base URL, so there is nothing extra to configure.
 *
 * `isMobileApp=true` is the flag Fastrr's bundle reads from the page's query
 * string to enable its in-app behaviour, alongside the `isInitiatedFromApp`
 * option passed to `addToCart`.
 */
export function getFastrrBaseUrl(session: FastrrSession): string {
  try {
    return `${new URL(session.fallbackUrl).origin}/?isMobileApp=true`;
  } catch {
    // A malformed fallbackUrl must not take checkout down; the seller is also
    // declared explicitly in the document below.
    return "https://checkout-ui.shiprocket.com/?isMobileApp=true";
  }
}

/** The merchant host Fastrr should attribute this checkout to. */
function sellerDomain(session: FastrrSession): string {
  try {
    return new URL(session.fallbackUrl).host;
  } catch {
    return "";
  }
}

/**
 * The page loaded into the WebView.
 *
 * Built here rather than pointed at our own website on purpose: the storefront
 * requires a logged-in browser session, and the WebView has no cookies from the
 * app. This document carries the already-minted token instead, so it needs no
 * authentication at all — and contains nothing but Fastrr's own bundle.
 *
 * `baseUrl` matters: Fastrr's script is loaded over https, and Android WebViews
 * block mixed/opaque origins, so the document is given an https origin — see
 * `getFastrrBaseUrl` for why it must be the *store's* origin specifically.
 */
export function buildFastrrCheckoutHtml(session: FastrrSession): string {
  // The token is injected as JSON so a stray quote can never break out of the
  // script and into executable markup.
  const payload = JSON.stringify({
    token: session.token,
    fallbackUrl: session.fallbackUrl,
  });

  // Same reason as `getFastrrBaseUrl`, stated explicitly so the merchant is
  // still correct even if the origin ever changes: the bundle prefers this
  // element's value over `window.location.host`.
  const seller = JSON.stringify(sellerDomain(session));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${session.styleUrl}" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <input type="hidden" id="sellerDomain" value="" />
  <script>
    (function () {
      var config = ${payload};

      // Set from script rather than inlined into the attribute so the value can
      // never break out of the markup.
      var sellerEl = document.getElementById("sellerDomain");
      if (sellerEl) sellerEl.value = ${seller};

      function post(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      // Fastrr reports its own failures by writing into this element rather than
      // throwing, so without watching it the app saw a silent blank overlay and
      // could only guess. Whatever it says is the real reason checkout stopped.
      function watchFastrrError() {
        var seen = "";
        setInterval(function () {
          var el = document.getElementById("sr-checkout-error-text");
          var text = el && el.innerText ? el.innerText.trim() : "";
          if (text && text !== seen) {
            seen = text;
            post({ type: "error", message: text });
          }
        }, 500);
      }

      function launch() {
        if (!window.HeadlessCheckout || !window.HeadlessCheckout.addToCart) {
          post({ type: "error", message: "Checkout failed to load" });
          return;
        }
        try {
          window.HeadlessCheckout.addToCart(
            new MouseEvent("click"),
            config.token,
            { fallbackUrl: config.fallbackUrl, isInitiatedFromApp: true }
          );
          post({ type: "opened" });
          watchFastrrError();
        } catch (err) {
          post({ type: "error", message: String((err && err.message) || err) });
        }
      }

      // A script error inside Fastrr's bundle would otherwise surface as nothing
      // at all — the overlay simply never appears.
      window.addEventListener("error", function (event) {
        post({
          type: "script-error",
          message: String((event && event.message) || "Unknown script error"),
        });
      });

      var script = document.createElement("script");
      script.src = "${session.scriptUrl}";
      script.async = true;
      script.onload = launch;
      // A failed bundle must report back rather than leaving the buyer on a
      // blank WebView with no way forward.
      script.onerror = function () {
        post({ type: "error", message: "Checkout failed to load" });
      };
      document.body.appendChild(script);
    })();
  </script>
</body>
</html>`;
}
