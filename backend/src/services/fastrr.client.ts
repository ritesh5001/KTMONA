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
} as const;

/**
 * The checkout UI bundle the storefront loads. Paired with the API host on
 * purpose: a token minted against production is not valid for the staging
 * bundle, so these two must move together.
 */
const UI_HOSTS = {
    SANDBOX: 'https://customcheckoutfastrr.netlify.app',
    PRODUCTION: 'https://checkout-ui.shiprocket.com',
} as const;

export function isFastrrConfigured(): boolean {
    return Boolean(env.FASTRR_API_KEY && env.FASTRR_API_SECRET);
}

/** Configured *and* switched on for buyers. */
export function isFastrrCheckoutEnabled(): boolean {
    return isFastrrConfigured() && env.FASTRR_CHECKOUT_ENABLED;
}

export function getFastrrBaseUrl(): string {
    return (env.FASTRR_BASE_URL ?? HOSTS[env.FASTRR_ENV]).replace(/\/+$/, '');
}

/** Script + stylesheet the client embeds to open the overlay. */
export function getFastrrUiAssets(): { scriptUrl: string; styleUrl: string } {
    const base = UI_HOSTS[env.FASTRR_ENV];
    return {
        scriptUrl: `${base}/assets/js/channels/shopify.js`,
        styleUrl: `${base}/assets/styles/shopify.css`,
    };
}

/** base64(HMAC-SHA256(body, secret)) — the value Fastrr expects verbatim. */
export function signFastrrBody(rawBody: string): string {
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
export function verifyFastrrSignature(rawBody: string, provided: string): boolean {
    if (!provided) return false;

    const expected = Buffer.from(signFastrrBody(rawBody), 'utf8');
    const actual = Buffer.from(provided.trim(), 'utf8');
    if (expected.length !== actual.length) return false;

    return timingSafeEqual(expected, actual);
}

/** Fastrr wraps every response in this envelope. */
interface FastrrEnvelope<T> {
    ok?: boolean;
    status?: boolean;
    result?: T;
    data?: T;
    error?: unknown;
}

async function fastrrRequest<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    if (!isFastrrConfigured()) {
        throw new ApiError(500, 'Fastrr checkout is not configured');
    }

    // `timestamp` is mandatory on every Fastrr endpoint and must be current UTC.
    const rawBody = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
    const url = `${getFastrrBaseUrl()}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.FASTRR_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': env.FASTRR_API_KEY!,
                'X-Api-HMAC-SHA256': signFastrrBody(rawBody),
            },
            body: rawBody,
            signal: controller.signal,
        });
    } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        paymentLogger.error(
            { event: 'fastrr_request_failed', path, aborted, error },
            `Fastrr request to ${path} failed`,
        );
        throw new ApiError(504, aborted ? 'Fastrr did not respond in time' : 'Could not reach Fastrr');
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text().catch(() => '');

    if (!response.ok) {
        paymentLogger.error(
            { event: 'fastrr_request_error', path, status: response.status, body: text.slice(0, 500) },
            `Fastrr returned ${response.status} for ${path}`,
        );
        // 511 is Fastrr's "bad key or bad signature". Surfacing it as a generic
        // upstream error hides a misconfiguration that no retry will fix.
        if (response.status === 511) {
            throw new ApiError(502, 'Fastrr rejected our API credentials');
        }
        throw new ApiError(502, `Fastrr request failed with status ${response.status}`);
    }

    let parsed: FastrrEnvelope<T>;
    try {
        parsed = JSON.parse(text) as FastrrEnvelope<T>;
    } catch {
        throw new ApiError(502, 'Fastrr returned a malformed response');
    }

    // `ok` on the checkout endpoints, `status` on the refund ones.
    if (parsed.ok === false || parsed.status === false) {
        paymentLogger.error(
            { event: 'fastrr_request_rejected', path, error: parsed.error },
            `Fastrr rejected the request to ${path}`,
        );
        throw new ApiError(502, 'Fastrr rejected the request');
    }

    const result = parsed.result ?? parsed.data;
    if (result === undefined) {
        throw new ApiError(502, 'Fastrr returned an empty result');
    }

    return result;
}

// ---------------------------------------------------------------------------
// Typed endpoint wrappers
// ---------------------------------------------------------------------------

export interface FastrrCartItem {
    variant_id: string;
    quantity: number;
    catalog_data?: {
        price: number;
        name: string;
        image_url: string;
    };
}

export interface FastrrAccessTokenRequest {
    cart_data: {
        items: FastrrCartItem[];
        cart_discount?: { coupon_code: string; amount: number };
        custom_attributes?: Record<string, string>;
        mobile_app: boolean;
    };
    redirect_url: string;
}

export interface FastrrAccessTokenResult {
    token: string;
    expires_at: string;
    data: { order_id: string };
}

export async function createFastrrAccessToken(
    request: FastrrAccessTokenRequest,
): Promise<FastrrAccessTokenResult> {
    return fastrrRequest<FastrrAccessTokenResult>(
        '/api/v1/access-token/checkout',
        request as unknown as Record<string, unknown>,
    );
}

export interface FastrrAddress {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    alternate_phone: string | null;
    email: string | null;
    line1: string | null;
    line2: string | null;
    landmark: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string | null;
    country_code: string | null;
}

export interface FastrrPayment {
    txn_id: string | null;
    payment_status: string | null;
    gateway: string | null;
    payment_method: string | null;
    amount: number | null;
    pg_transaction_id: string | null;
    amount_received: number | null;
    created_at: string | null;
}

/** Fastrr's view of an order. Almost every field is null until status=SUCCESS. */
export interface FastrrOrderDetails {
    order_id: string;
    cart_data: { items: Array<{ variant_id: string; quantity: number }> } | null;
    redirect_url: string | null;
    status: 'CREATED' | 'INITIATED' | 'FAILED' | 'SUCCESS' | string;
    source: string | null;
    phone: string | null;
    email: string | null;
    shipping_plan: string | null;
    shipping_address: FastrrAddress | null;
    billing_address: FastrrAddress | null;
    shipping_charges: number | null;
    cod_charges: number | null;
    edd: string | null;
    rto_prediction: string | null;
    payment_type: 'CASH_ON_DELIVERY' | 'PREPAID' | string | null;
    payment_status: 'Pending' | 'Success' | 'Failed' | string | null;
    payments: FastrrPayment[] | null;
    coupon_codes: string[] | null;
    coupon_discount: number | null;
    prepaid_discount: number | null;
    total_discount: number | null;
    subtotal_price: number | null;
    total_amount_payable: number | null;
    platform_order_id: string | null;
    fastrr_order_id: string | null;
    cart_id: string | null;
    order_created_date: string | null;
    tags: string[] | null;
}

export async function getFastrrOrderDetails(orderId: string): Promise<FastrrOrderDetails> {
    return fastrrRequest<FastrrOrderDetails>('/api/v1/custom-platform-order/details', {
        order_id: orderId,
    });
}

export interface FastrrOrderListResult {
    total: number;
    page: number;
    limit: number;
    data: Array<{ id: string; status: string }>;
}

export async function listFastrrOrders(params: {
    startDate: string;
    endDate: string;
    status?: 'SUCCESS' | 'INITIATED';
    limit?: number;
    page?: number;
}): Promise<FastrrOrderListResult> {
    return fastrrRequest<FastrrOrderListResult>(
        '/api/v1/custom-platform-order/details/list',
        params as unknown as Record<string, unknown>,
    );
}

export interface FastrrRefundResult {
    success?: boolean;
    data?: {
        id: string;
        transaction_id: string | null;
        amount: number;
        status: string;
        message: string | null;
        cart_id: string | null;
    };
}

/** `orderId` accepts either the platform order id or the fastrr order id. */
export async function initiateFastrrRefund(
    orderId: string,
    amount: number,
): Promise<FastrrRefundResult> {
    return fastrrRequest<FastrrRefundResult>('/api/v1/external/refund/initiate', {
        order_id: orderId,
        amount,
    });
}

if (env.FASTRR_CHECKOUT_ENABLED && !isFastrrConfigured()) {
    console.warn(
        '[Fastrr] FASTRR_CHECKOUT_ENABLED is set but FASTRR_API_KEY/FASTRR_API_SECRET are missing — ' +
        'checkout will continue to use PhonePe.',
    );
}
