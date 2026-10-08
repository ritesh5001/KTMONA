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
export declare function isFastrrConfigured(): boolean;
/** Configured *and* switched on for buyers. */
export declare function isFastrrCheckoutEnabled(): boolean;
export declare function getFastrrBaseUrl(): string;
/** Script + stylesheet the client embeds to open the overlay. */
export declare function getFastrrUiAssets(): {
    scriptUrl: string;
    styleUrl: string;
};
/** base64(HMAC-SHA256(body, secret)) — the value Fastrr expects verbatim. */
export declare function signFastrrBody(rawBody: string): string;
/**
 * Constant-time check of a signature someone else calculated.
 *
 * Used for inbound traffic only. A plain `===` on a secret-derived value leaks
 * how many leading bytes matched, which is enough to forge one byte at a time.
 */
export declare function verifyFastrrSignature(rawBody: string, provided: string): boolean;
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
        cart_discount?: {
            coupon_code: string;
            amount: number;
        };
        custom_attributes?: Record<string, string>;
        mobile_app: boolean;
    };
    redirect_url: string;
}
export interface FastrrAccessTokenResult {
    token: string;
    expires_at: string;
    data: {
        order_id: string;
    };
}
export declare function createFastrrAccessToken(request: FastrrAccessTokenRequest): Promise<FastrrAccessTokenResult>;
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
    cart_data: {
        items: Array<{
            variant_id: string;
            quantity: number;
        }>;
    } | null;
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
export declare function getFastrrOrderDetails(orderId: string): Promise<FastrrOrderDetails>;
export interface FastrrOrderListResult {
    total: number;
    page: number;
    limit: number;
    data: Array<{
        id: string;
        status: string;
    }>;
}
export declare function listFastrrOrders(params: {
    startDate: string;
    endDate: string;
    status?: 'SUCCESS' | 'INITIATED';
    limit?: number;
    page?: number;
}): Promise<FastrrOrderListResult>;
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
export declare function initiateFastrrRefund(orderId: string, amount: number): Promise<FastrrRefundResult>;
//# sourceMappingURL=fastrr.client.d.ts.map