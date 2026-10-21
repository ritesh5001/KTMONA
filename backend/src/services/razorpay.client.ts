/**
 * Razorpay Client
 *
 * Thin wrapper over the Razorpay REST API (orders, payments, refunds) plus the
 * two HMAC checks Razorpay uses: the checkout signature (order_id|payment_id,
 * signed with the key secret) and the webhook signature (raw body, signed with
 * the webhook secret). Amounts on the wire are in paise.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { paymentLogger } from '../config/logger.js';

const API_BASE = 'https://api.razorpay.com/v1';
const REQUEST_TIMEOUT_MS = 20_000;

export interface RazorpayOrder {
    id: string;
    amount: number;
    amount_paid: number;
    currency: string;
    receipt: string | null;
    status: 'created' | 'attempted' | 'paid';
}

export interface RazorpayPayment {
    id: string;
    order_id: string | null;
    amount: number;
    currency: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    method?: string;
    error_description?: string | null;
}

export interface RazorpayRefund {
    id: string;
    payment_id: string;
    amount: number;
    status: 'pending' | 'processed' | 'failed';
}

export function isRazorpayConfigured(): boolean {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** Rupees → paise. Razorpay rejects fractional paise. */
export function toPaise(amount: number): number {
    return Math.round(amount * 100);
}

async function razorpayRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!isRazorpayConfigured()) {
        throw new ApiError(503, 'Online payments are not available right now. Please try again later.');
    }

    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                Authorization: `Basic ${auth}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch (error) {
        paymentLogger.error({ event: 'razorpay_request_failed', method, path, error }, 'Razorpay request failed');
        throw new ApiError(502, 'Could not reach the payment gateway. Please try again.');
    }

    const json = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
        const description: string = json?.error?.description ?? `HTTP ${response.status}`;
        paymentLogger.error(
            { event: 'razorpay_api_error', method, path, status: response.status, code: json?.error?.code, description },
            'Razorpay API error',
        );
        throw new ApiError(502, `Payment gateway error: ${description}`);
    }
    return json as T;
}

export function createRazorpayOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
    return razorpayRequest<RazorpayOrder>('POST', '/orders', {
        amount: toPaise(input.amount),
        currency: 'INR',
        // Razorpay caps receipts at 40 characters.
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
    });
}

export function fetchRazorpayPayment(paymentId: string) {
    return razorpayRequest<RazorpayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

/** Every payment attempt made against one Razorpay order. */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const res = await razorpayRequest<{ items: RazorpayPayment[] }>('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
    return res.items ?? [];
}

/** Capture an authorized payment. Accounts on auto-capture never need this. */
export function captureRazorpayPayment(paymentId: string, amountPaise: number) {
    return razorpayRequest<RazorpayPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, {
        amount: amountPaise,
        currency: 'INR',
    });
}

export function refundRazorpayPayment(paymentId: string, amount: number, notes: Record<string, string>) {
    return razorpayRequest<RazorpayRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, {
        amount: toPaise(amount),
        notes,
    });
}

function safeEqualHex(expected: string, received: string): boolean {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
}

/** The signature Checkout hands back after a successful payment. */
export function isValidCheckoutSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
    if (!env.RAZORPAY_KEY_SECRET || !signature) return false;
    const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    return safeEqualHex(expected, signature);
}

/** X-Razorpay-Signature on a webhook: HMAC of the exact raw request body. */
export function isValidWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
    const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    return safeEqualHex(expected, signature);
}
