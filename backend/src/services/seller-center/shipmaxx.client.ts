/**
 * ShipMaxx shipping API (appapi.losung360.com/external/v1, docs at /docs):
 * create order → assign AWB (carrier picked by their rate engine) → label →
 * tracking. Used when SHIPMAXX_EMAIL/PASSWORD/CHANNEL_ID are set.
 *
 * Their limits shape this client: tokens last 24h with no refresh endpoint,
 * and every call shares a 2 requests/second budget per company, so calls are
 * queued through one throttle and a 401/429 is retried once.
 */

import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';

const log = logger.child({ module: 'shipmaxx' });

/** Leaves headroom under the documented 2 req/s. */
const MIN_GAP_MS = 550;

let cachedToken: { value: string; expiresAt: number } | null = null;
let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

export function isShipmaxxShippingEnabled(): boolean {
    return Boolean(env.SHIPMAXX_EMAIL && env.SHIPMAXX_PASSWORD && env.SHIPMAXX_CHANNEL_ID);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` after every earlier call, at most one call per MIN_GAP_MS. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
        const wait = lastCallAt + MIN_GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastCallAt = Date.now();
        return fn();
    });
    queue = run.catch(() => undefined);
    return run;
}

function errorText(body: unknown, status: number): string {
    const b = body as { detail?: unknown; message?: unknown; errors?: Record<string, unknown> } | null;
    if (b?.errors && typeof b.errors === 'object') {
        return Object.entries(b.errors).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
    }
    if (typeof b?.detail === 'string') return b.detail;
    if (typeof b?.message === 'string') return b.message;
    return `request failed (${status})`;
}

async function token(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
    const res = await throttled(() =>
        fetch(`${env.SHIPMAXX_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_id: env.SHIPMAXX_EMAIL, password: env.SHIPMAXX_PASSWORD }),
        }),
    );
    const body = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (!res.ok || !body.access_token) {
        throw new ApiError(502, `ShipMaxx login failed: ${errorText(body, res.status)}`);
    }
    // Tokens last 24 hours; renew an hour early.
    cachedToken = { value: body.access_token, expiresAt: Date.now() + 23 * 3_600_000 };
    return body.access_token;
}

interface CallResult<T> {
    status: number;
    body: T;
}

/** One authenticated call. Returns non-2xx responses for the caller to inspect. */
async function rawCall<T>(method: 'GET' | 'POST' | 'PUT', path: string, payload?: unknown, retried = false): Promise<CallResult<T>> {
    const auth = await token();
    const res = await throttled(() =>
        fetch(`${env.SHIPMAXX_BASE_URL}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${auth}`,
                ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        }),
    );
    if (!retried && res.status === 401) {
        cachedToken = null;
        return rawCall(method, path, payload, true);
    }
    if (!retried && res.status === 429) {
        await sleep(1500);
        return rawCall(method, path, payload, true);
    }
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
}

async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, payload?: unknown): Promise<T> {
    const { status, body } = await rawCall<T>(method, path, payload);
    if (status < 200 || status >= 300) {
        const message = errorText(body, status);
        log.warn({ path, status, message }, 'ShipMaxx call failed');
        throw new ApiError(status === 404 ? 404 : 502, `ShipMaxx: ${message}`);
    }
    return body;
}

// ── Warehouses ──────────────────────────────────────────────────────────────

export interface ShipmaxxWarehouseInput {
    sellerCode: string;
    contactName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    gstin?: string | null | undefined;
}

/**
 * Register a pickup address and return its warehouse id. ShipMaxx cannot edit
 * a warehouse, so the name carries a hash of the address: a changed address
 * gets a new warehouse, and re-sending the same one returns the existing id.
 */
export async function ensureWarehouse(input: ShipmaxxWarehouseInput): Promise<number> {
    const fingerprint = createHash('sha1')
        .update([input.address, input.city, input.state, input.pincode].join('|').toLowerCase())
        .digest('hex')
        .slice(0, 6);
    const { status, body } = await rawCall<{ id?: number; warehouse_id?: number }>('POST', '/warehouses/create', {
        name: `KTMONA ${input.sellerCode} ${fingerprint}`,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        contact_person: input.contactName,
        contact_number: input.phone,
        is_default: false,
        ...(input.gstin ? { gst_number: input.gstin } : {}),
    });
    const id = status >= 200 && status < 300 ? body.id : status === 400 || status === 409 ? body.warehouse_id : undefined;
    if (!id) throw new ApiError(502, `ShipMaxx: could not register pickup address (${errorText(body, status)})`);
    return id;
}

// ── Orders + shipments ──────────────────────────────────────────────────────

export interface ShipmaxxOrderInput {
    /** Our reference; also used to find an order a failed earlier attempt created. */
    orderNumber: string;
    warehouseId: number;
    paymentMethod: 'prepaid' | 'cod';
    customer: { name: string; phone: string; email?: string | null; address: string; city: string; state: string; pincode: string };
    items: { name: string; sku: string; price: number; quantity: number }[];
    weightKg: number;
    dimensionsCm: { length: number; width: number; height: number };
}

export interface ShipmaxxBooking {
    shipmaxxOrderId: string;
    awb: string;
    courier: string;
    labelUrl: string | null;
}

/** An order created for `orderNumber` by an earlier attempt that failed later on. */
async function findOrder(orderNumber: string): Promise<{ order_id: number; awb?: string | null } | null> {
    try {
        const res = await call<{ data?: { order_id: number; awb?: string | null; order_number?: string; order_status?: string }[] }>(
            'GET',
            `/orders?q=${encodeURIComponent(orderNumber)}&limit=5`,
        );
        return res.data?.find((o) => o.order_number === orderNumber && !/cancel/i.test(o.order_status ?? '')) ?? null;
    } catch (err) {
        // Only a duplicate-avoidance check: a failed search must not block booking.
        log.warn({ err: err instanceof Error ? err.message : String(err), orderNumber }, 'ShipMaxx order lookup failed');
        return null;
    }
}

/** Create the order (or reuse the one a failed attempt left) and assign an AWB. */
export async function bookShipment(input: ShipmaxxOrderInput): Promise<ShipmaxxBooking> {
    const existing = await findOrder(input.orderNumber);
    if (existing?.awb) {
        throw new ApiError(409, `ShipMaxx already has AWB ${existing.awb} for this order`);
    }
    const orderId =
        existing?.order_id ??
        (
            await call<{ data?: { order_id?: number } }>('POST', '/orders/create', {
                pickup_address_id: input.warehouseId,
                channel_id: env.SHIPMAXX_CHANNEL_ID,
                payment_method: input.paymentMethod,
                order_number: input.orderNumber,
                customer: {
                    name: input.customer.name,
                    phone: input.customer.phone,
                    ...(input.customer.email ? { email: input.customer.email } : {}),
                    address: input.customer.address,
                    pincode: input.customer.pincode,
                    city: input.customer.city,
                    state: input.customer.state,
                },
                products: input.items,
                package: {
                    weight: input.weightKg,
                    length: input.dimensionsCm.length,
                    width: input.dimensionsCm.width,
                    height: input.dimensionsCm.height,
                },
            })
        ).data?.order_id;
    if (!orderId) throw new ApiError(502, 'ShipMaxx did not return an order id');

    const shipment = await call<{ success?: boolean; awb?: string; courier_name?: string; label_url?: string | null; detail?: string }>(
        'POST',
        '/shipping/create-shipment',
        { order_id: String(orderId), warehouse_id: input.warehouseId },
    );
    if (!shipment.awb) {
        throw new ApiError(502, `ShipMaxx did not assign an AWB${shipment.detail ? `: ${shipment.detail}` : '. Check serviceability for this pincode.'}`);
    }
    return {
        shipmaxxOrderId: String(orderId),
        awb: shipment.awb,
        courier: shipment.courier_name ? courierLabel(shipment.courier_name) : 'ShipMaxx',
        labelUrl: shipment.label_url ?? null,
    };
}

function courierLabel(code: string): string {
    return code.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Cancel an assigned AWB; ShipMaxx refunds the shipping charge to the wallet.
 * An AWB ShipMaxx no longer holds (404) counts as already cancelled, so a
 * retried cancellation goes through.
 */
export async function cancelShipment(awb: string, reason: string): Promise<void> {
    const { status, body } = await rawCall<{ success?: boolean; message?: string }>('POST', '/shipping/cancel-shipment', {
        awb,
        cancellation_reason: reason,
    });
    if (status === 404) return;
    if (status < 200 || status >= 300) throw new ApiError(502, `ShipMaxx: ${errorText(body, status)}`);
    if (body.success === false) throw ApiError.badRequest(`Courier did not cancel the shipment: ${body.message ?? 'rejected'}`);
}

export interface ShipmaxxTracking {
    currentStatus: string | null;
    history: { status: string; timestamp?: string; location?: string }[];
}

export async function trackShipment(awb: string): Promise<ShipmaxxTracking> {
    const res = await call<{ current_status?: string | null; history?: ShipmaxxTracking['history'] }>(
        'GET',
        `/shipping/track-shipment?awb=${encodeURIComponent(awb)}`,
    );
    return { currentStatus: res.current_status ?? null, history: res.history ?? [] };
}
