/**
 * PhonePe Service — Standard Checkout v2.
 *
 * - Create a hosted checkout order (buyer is redirected to redirectUrl)
 * - Poll order status (the trusted, server-to-server confirmation)
 * - Initiate refunds
 * - Verify webhook authorization
 */
export type PhonePeOrderState = 'PENDING' | 'COMPLETED' | 'FAILED';
export interface PhonePeCreateOrderResponse {
    phonepeOrderId: string;
    state: PhonePeOrderState;
    redirectUrl: string;
    merchantOrderId: string;
    amount: number;
}
/**
 * What a mobile app needs to open the PhonePe SDK.
 *
 * PhonePe no longer permits a WebView or browser redirect inside a mobile app —
 * the hosted checkout page refuses to render there, which is what produced
 * "Something went wrong" on their own domain after the buyer had committed. The
 * app must hand these three values to the native SDK instead.
 */
export interface PhonePeSdkOrderResponse {
    /** PhonePe's own order id, echoed back to the SDK. */
    phonepeOrderId: string;
    /** Short-lived token authorising this one checkout. */
    token: string;
    state: PhonePeOrderState;
    merchantOrderId: string;
    amount: number;
    /** Epoch millis. The SDK must be opened before this. */
    expireAt: number;
}
export interface PhonePeOrderStatusResponse {
    orderId: string;
    state: PhonePeOrderState;
    amount: number;
    paymentDetails?: Array<{
        transactionId?: string;
        paymentMode?: string;
        state?: string;
        amount?: number;
        timestamp?: number;
        errorCode?: string;
        detailedErrorCode?: string;
    }>;
}
export interface PhonePeWebhookEvent {
    event: string;
    merchantOrderId?: string;
    phonepeOrderId?: string;
    state?: string;
    amount?: number;
    transactionId?: string;
}
export declare class PhonePeService {
    /**
     * Build a unique merchant order id for one payment attempt.
     * PhonePe requires uniqueness per /pay call, so each retry gets a suffix.
     * Stored as payment.providerOrderId for later lookup.
     */
    buildMerchantOrderId(orderId: string): string;
    /**
     * Inverse of buildMerchantOrderId: recover our local order id from a PhonePe
     * merchantOrderId (`<orderId>_<base36 timestamp>`). Order ids are cuids, so they
     * contain no underscores — splitting at the LAST underscore is unambiguous.
     *
     * Needed because a retry mints a fresh merchantOrderId and overwrites
     * Payment.providerOrderId, leaving webhooks for earlier attempts unmatchable.
     */
    parseOrderIdFromMerchantOrderId(merchantOrderId: string): string | null;
    /**
     * Create a PhonePe Standard Checkout order.
     * @param amount - rupees (converted to paise internally)
     */
    createOrder(amount: number, merchantOrderId: string, redirectUrl: string, meta?: {
        orderId?: string;
        userId?: string;
    }): Promise<PhonePeCreateOrderResponse>;
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
    createSdkOrder(amount: number, merchantOrderId: string, meta?: {
        orderId?: string;
        userId?: string;
    }): Promise<PhonePeSdkOrderResponse>;
    getOrderStatus(merchantOrderId: string): Promise<PhonePeOrderStatusResponse>;
    /**
     * Initiate a refund against a completed PhonePe order.
     * @param amount - rupees
     */
    initiateRefund(merchantRefundId: string, originalMerchantOrderId: string, amount: number): Promise<{
        refundId: string;
        state: string;
    }>;
    /**
     * Verify the Authorization header on a PhonePe webhook.
     * PhonePe sends SHA256(username:password) where the pair is configured on
     * the dashboard and mirrored in PHONEPE_WEBHOOK_USERNAME / _PASSWORD.
     */
    verifyWebhookAuthorization(authorizationHeader: string): boolean;
    /** Normalize a PhonePe webhook body into a flat event. */
    parseWebhookEvent(payload: any): PhonePeWebhookEvent;
}
export declare const phonepeService: PhonePeService;
//# sourceMappingURL=phonepe.service.d.ts.map