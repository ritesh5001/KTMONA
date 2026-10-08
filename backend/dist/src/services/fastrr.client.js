/**
 * Shiprocket Checkout (Fastrr) API client.
 *
 * Auth is a per-request signature rather than a session token: every call sends
 * `X-Api-Key` plus `X-Api-HMAC-SHA256`, the base64 HMAC-SHA256 of the *request
 * body* keyed by the API secret. Two consequences drive the shape of this file:
 *
 *   - The signature covers the exact bytes on the wire, so the body is
 *     serialised once here and both signed and sent. Re-serialising (or letting
 *     `fetch` stringify an object) would silently produce a signature over
 *     different bytes and every request would 511.
 *
 *   - Fastrr rejects a stale `timestamp`, so it is stamped at call time inside
 *     this module rather than by callers who might cache a payload.
 *
 * The catalog half of this integration lives in shiprocket-catalog.service.ts —
 * that one is Shiprocket pulling from us, this one is us calling them.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { paymentLogger } from '../config/logger.js';
const HOSTS = {
    SANDBOX: 'https://fastrr-api-dev.pickrr.com',
    PRODUCTION: 'https://checkout-api.shiprocket.com',
};
/**
 * The checkout UI bundle the storefront loads. Paired with the API host on
 * purpose: a token minted against production is not valid for the staging
 * bundle, so these two must move together.
 */
const UI_HOSTS = {
    SANDBOX: 'https://customcheckoutfastrr.netlify.app',
    PRODUCTION: 'https://checkout-ui.shiprocket.com',
};
export function isFastrrConfigured() {
    return Boolean(env.FASTRR_API_KEY && env.FASTRR_API_SECRET);
}
/** Configured *and* switched on for buyers. */
export function isFastrrCheckoutEnabled() {
    return isFastrrConfigured() && env.FASTRR_CHECKOUT_ENABLED;
}
export function getFastrrBaseUrl() {
    return (env.FASTRR_BASE_URL ?? HOSTS[env.FASTRR_ENV]).replace(/\/+$/, '');
}
/** Script + stylesheet the client embeds to open the overlay. */
export function getFastrrUiAssets() {
    const base = UI_HOSTS[env.FASTRR_ENV];
    return {
        scriptUrl: `${base}/assets/js/channels/shopify.js`,
        styleUrl: `${base}/assets/styles/shopify.css`,
    };
}
/** base64(HMAC-SHA256(body, secret)) — the value Fastrr expects verbatim. */
export function signFastrrBody(rawBody) {
    if (!env.FASTRR_API_SECRET) {
        throw new ApiError(500, 'Fastrr is not configured');
    }
    return createHmac('sha256', env.FASTRR_API_SECRET).update(rawBody, 'utf8').digest('base64');
}
/**
 * Constant-time check of a signature someone else calculated.
 *
 * Used for inbound traffic only. A plain `===` on a secret-derived value leaks
 * how many leading bytes matched, which is enough to forge one byte at a time.
 */
export function verifyFastrrSignature(rawBody, provided) {
    if (!provided)
        return false;
    const expected = Buffer.from(signFastrrBody(rawBody), 'utf8');
    const actual = Buffer.from(provided.trim(), 'utf8');
    if (expected.length !== actual.length)
        return false;
    return timingSafeEqual(expected, actual);
}
async function fastrrRequest(path, payload) {
    if (!isFastrrConfigured()) {
        throw new ApiError(500, 'Fastrr checkout is not configured');
    }
    // `timestamp` is mandatory on every Fastrr endpoint and must be current UTC.
    const rawBody = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
    const url = `${getFastrrBaseUrl()}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.FASTRR_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': env.FASTRR_API_KEY,
                'X-Api-HMAC-SHA256': signFastrrBody(rawBody),
            },
            body: rawBody,
            signal: controller.signal,
        });
    }
    catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        paymentLogger.error({ event: 'fastrr_request_failed', path, aborted, error }, `Fastrr request to ${path} failed`);
        throw new ApiError(504, aborted ? 'Fastrr did not respond in time' : 'Could not reach Fastrr');
    }
    finally {
        clearTimeout(timer);
    }
    const text = await response.text().catch(() => '');
    if (!response.ok) {
        paymentLogger.error({ event: 'fastrr_request_error', path, status: response.status, body: text.slice(0, 500) }, `Fastrr returned ${response.status} for ${path}`);
        // 511 is Fastrr's "bad key or bad signature". Surfacing it as a generic
        // upstream error hides a misconfiguration that no retry will fix.
        if (response.status === 511) {
            throw new ApiError(502, 'Fastrr rejected our API credentials');
        }
        throw new ApiError(502, `Fastrr request failed with status ${response.status}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new ApiError(502, 'Fastrr returned a malformed response');
    }
    // `ok` on the checkout endpoints, `status` on the refund ones.
    if (parsed.ok === false || parsed.status === false) {
        paymentLogger.error({ event: 'fastrr_request_rejected', path, error: parsed.error }, `Fastrr rejected the request to ${path}`);
        throw new ApiError(502, 'Fastrr rejected the request');
    }
    const result = parsed.result ?? parsed.data;
    if (result === undefined) {
        throw new ApiError(502, 'Fastrr returned an empty result');
    }
    return result;
}
export async function createFastrrAccessToken(request) {
    return fastrrRequest('/api/v1/access-token/checkout', request);
}
export async function getFastrrOrderDetails(orderId) {
    return fastrrRequest('/api/v1/custom-platform-order/details', {
        order_id: orderId,
    });
}
export async function listFastrrOrders(params) {
    return fastrrRequest('/api/v1/custom-platform-order/details/list', params);
}
/** `orderId` accepts either the platform order id or the fastrr order id. */
export async function initiateFastrrRefund(orderId, amount) {
    return fastrrRequest('/api/v1/external/refund/initiate', {
        order_id: orderId,
        amount,
    });
}
if (env.FASTRR_CHECKOUT_ENABLED && !isFastrrConfigured()) {
    console.warn('[Fastrr] FASTRR_CHECKOUT_ENABLED is set but FASTRR_API_KEY/FASTRR_API_SECRET are missing — ' +
        'checkout will continue to use PhonePe.');
}
//# sourceMappingURL=fastrr.client.js.map