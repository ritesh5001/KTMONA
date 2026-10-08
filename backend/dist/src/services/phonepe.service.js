/**
 * PhonePe Service — Standard Checkout v2.
 *
 * - Create a hosted checkout order (buyer is redirected to redirectUrl)
 * - Poll order status (the trusted, server-to-server confirmation)
 * - Initiate refunds
 * - Verify webhook authorization
 */
import crypto from 'crypto';
import { getPhonePeAccessToken, getPhonePeApiBaseUrl, invalidatePhonePeToken, isPhonePeConfigured, } from './phonepe.client.js';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { paymentLogger } from '../config/logger.js';
/** Checkout order expiry passed to PhonePe (seconds). Matches our 30-min TTL. */
const ORDER_EXPIRE_AFTER_SECONDS = 30 * 60;
/**
 * Status checks currently open, keyed by merchant order id.
 *
 * Entries are removed as soon as the request settles, so this never holds a
 * result — it only stops the same question being asked of PhonePe several times
 * at once while a buyer's checkout screen is polling.
 */
const inflightStatusChecks = new Map();
async function phonePeRequest(method, path, body, isRetry = false) {
    const token = await getPhonePeAccessToken();
    const response = await fetch(`${getPhonePeApiBaseUrl()}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `O-Bearer ${token}`,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    // Token may have been revoked server-side — refresh once and retry.
    if (response.status === 401 && !isRetry) {
        invalidatePhonePeToken();
        return phonePeRequest(method, path, body, true);
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        paymentLogger.error({ event: 'phonepe_api_error', path, status: response.status, body: text.slice(0, 500) }, `PhonePe API request failed: ${path}`);
        throw new ApiError(502, `PhonePe API request failed with status ${response.status}`);
    }
    return (await response.json());
}
export class PhonePeService {
    /**
     * Build a unique merchant order id for one payment attempt.
     * PhonePe requires uniqueness per /pay call, so each retry gets a suffix.
     * Stored as payment.providerOrderId for later lookup.
     */
    buildMerchantOrderId(orderId) {
        const suffix = Date.now().toString(36);
        const sanitized = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
        return `${sanitized}_${suffix}`.slice(0, 63);
    }
    /**
     * Inverse of buildMerchantOrderId: recover our local order id from a PhonePe
     * merchantOrderId (`<orderId>_<base36 timestamp>`). Order ids are cuids, so they
     * contain no underscores — splitting at the LAST underscore is unambiguous.
     *
     * Needed because a retry mints a fresh merchantOrderId and overwrites
     * Payment.providerOrderId, leaving webhooks for earlier attempts unmatchable.
     */
    parseOrderIdFromMerchantOrderId(merchantOrderId) {
        const separator = merchantOrderId.lastIndexOf('_');
        if (separator <= 0)
            return null;
        const candidate = merchantOrderId.slice(0, separator);
        return candidate.length > 0 ? candidate : null;
    }
    /**
     * Create a PhonePe Standard Checkout order.
     * @param amount - rupees (converted to paise internally)
     */
    async createOrder(amount, merchantOrderId, redirectUrl, meta) {
        if (!isPhonePeConfigured()) {
            throw new ApiError(500, 'PhonePe is not configured');
        }
        const amountInPaise = Math.round(amount * 100);
        // Logged before the call, because a rejection shows up on PhonePe's own
        // domain as a generic "Something went wrong" with nothing in our logs to
        // explain it. These three fields are what PhonePe validates, so having
        // them recorded turns an opaque gateway error into a readable one.
        paymentLogger.info({
            event: 'phonepe_create_order',
            merchantOrderId,
            amountInPaise,
            redirectUrl,
        }, 'Creating PhonePe checkout order');
        try {
            const data = await phonePeRequest('POST', '/checkout/v2/pay', {
                merchantOrderId,
                amount: amountInPaise,
                expireAfter: ORDER_EXPIRE_AFTER_SECONDS,
                metaInfo: {
                    udf1: meta?.orderId ?? '',
                    udf2: meta?.userId ?? '',
                },
                paymentFlow: {
                    type: 'PG_CHECKOUT',
                    message: 'Tatvivah order payment',
                    merchantUrls: { redirectUrl },
                },
            });
            if (!data.redirectUrl) {
                throw new ApiError(502, 'PhonePe did not return a checkout URL');
            }
            return {
                phonepeOrderId: data.orderId,
                state: data.state,
                redirectUrl: data.redirectUrl,
                merchantOrderId,
                amount: amountInPaise,
            };
        }
        catch (error) {
            if (error instanceof ApiError)
                throw error;
            paymentLogger.error({ event: 'phonepe_order_failed', merchantOrderId, error: error?.message }, 'PhonePe order creation failed');
            throw new ApiError(502, `PhonePe order creation failed: ${error?.message ?? 'Unknown error'}`);
        }
    }
    /** Fetch the authoritative order state from PhonePe. */
    /**
     * Create an order for the mobile SDK.
     *
     * Distinct from `createOrder`, which produces a hosted-checkout redirectUrl
     * for the website. PhonePe blocks that flow inside apps, so mobile uses
     * /checkout/v2/sdk/order and receives a token the native SDK consumes.
     * Verified against the live API: the response carries orderId, state,
     * expireAt and token.
     *
     * No redirectUrl is involved. The SDK returns the outcome to the app
     * directly, and the webhook remains the authoritative confirmation.
     *
     * @param amount - rupees (converted to paise internally)
     */
    async createSdkOrder(amount, merchantOrderId, meta) {
        if (!isPhonePeConfigured()) {
            throw new ApiError(500, 'PhonePe is not configured');
        }
        const amountInPaise = Math.round(amount * 100);
        paymentLogger.info({ event: 'phonepe_create_sdk_order', merchantOrderId, amountInPaise }, 'Creating PhonePe SDK order');
        const data = await phonePeRequest('POST', '/checkout/v2/sdk/order', {
            merchantOrderId,
            amount: amountInPaise,
            expireAfter: ORDER_EXPIRE_AFTER_SECONDS,
            metaInfo: {
                udf1: meta?.orderId ?? '',
                udf2: meta?.userId ?? '',
            },
            paymentFlow: { type: 'PG_CHECKOUT' },
        });
        if (!data.token) {
            throw new ApiError(502, 'PhonePe did not return an SDK order token');
        }
        return {
            phonepeOrderId: data.orderId,
            token: data.token,
            state: data.state,
            merchantOrderId,
            amount: amountInPaise,
            expireAt: data.expireAt,
        };
    }
    async getOrderStatus(merchantOrderId) {
        if (!isPhonePeConfigured()) {
            throw new ApiError(500, 'PhonePe is not configured');
        }
        // The checkout screen polls every 700ms while the buyer is paying, and
        // each poll used to open its own round trip to PhonePe. Several requests
        // for the same order would then queue behind each other, so the answer
        // arrived slower the harder we asked for it.
        //
        // Callers that arrive while a check is already in flight share its
        // result. This is deduplication, not caching — nothing is held after the
        // response lands, so a status can never be served stale.
        const inflight = inflightStatusChecks.get(merchantOrderId);
        if (inflight)
            return inflight;
        const request = phonePeRequest('GET', `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`).finally(() => {
            inflightStatusChecks.delete(merchantOrderId);
        });
        inflightStatusChecks.set(merchantOrderId, request);
        return request;
    }
    /**
     * Initiate a refund against a completed PhonePe order.
     * @param amount - rupees
     */
    async initiateRefund(merchantRefundId, originalMerchantOrderId, amount) {
        if (!isPhonePeConfigured()) {
            throw new ApiError(500, 'PhonePe is not configured');
        }
        const sanitizedRefundId = merchantRefundId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 63);
        const data = await phonePeRequest('POST', '/payments/v2/refund', {
            merchantRefundId: sanitizedRefundId,
            originalMerchantOrderId,
            amount: Math.round(amount * 100),
        });
        return { refundId: data.refundId, state: data.state };
    }
    /**
     * Verify the Authorization header on a PhonePe webhook.
     * PhonePe sends SHA256(username:password) where the pair is configured on
     * the dashboard and mirrored in PHONEPE_WEBHOOK_USERNAME / _PASSWORD.
     */
    verifyWebhookAuthorization(authorizationHeader) {
        if (!env.PHONEPE_WEBHOOK_USERNAME || !env.PHONEPE_WEBHOOK_PASSWORD) {
            paymentLogger.error({ event: 'phonepe_webhook_credentials_missing' }, 'PhonePe webhook credentials not configured');
            return false;
        }
        if (!authorizationHeader)
            return false;
        const expected = crypto
            .createHash('sha256')
            .update(`${env.PHONEPE_WEBHOOK_USERNAME}:${env.PHONEPE_WEBHOOK_PASSWORD}`)
            .digest('hex');
        // Header may arrive as "SHA256 <hash>" or just the hash.
        const received = authorizationHeader.replace(/^sha256\s+/i, '').trim().toLowerCase();
        try {
            return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
        }
        catch {
            return false;
        }
    }
    /** Normalize a PhonePe webhook body into a flat event. */
    parseWebhookEvent(payload) {
        const event = payload?.event ?? payload?.type ?? '';
        const inner = payload?.payload ?? {};
        const paymentDetail = Array.isArray(inner.paymentDetails) ? inner.paymentDetails[0] : undefined;
        return {
            event,
            merchantOrderId: inner.merchantOrderId ?? inner.originalMerchantOrderId,
            phonepeOrderId: inner.orderId,
            state: inner.state,
            amount: inner.amount,
            transactionId: paymentDetail?.transactionId,
        };
    }
}
export const phonepeService = new PhonePeService();
//# sourceMappingURL=phonepe.service.js.map