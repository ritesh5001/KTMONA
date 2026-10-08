/**
 * Turning a completed Shiprocket Checkout (Fastrr) checkout into a Tatvivah order.
 *
 * Three independent triggers call in here — the order webhook, the callback page
 * polling after the buyer is redirected back, and the reconciliation sweep — and
 * Fastrr's own docs warn that webhooks may be delivered more than once. So the
 * single most important property of this file is that running it twice for the
 * same checkout produces exactly one order. That is enforced in two layers:
 *
 *   1. `SELECT ... FOR UPDATE` on the session row serialises concurrent callers,
 *      so two of them cannot both pass the "already materialised?" check.
 *   2. `fastrr_checkout_sessions.order_id` is UNIQUE, so even if layer 1 were
 *      somehow bypassed the second insert fails rather than double-charging
 *      inventory.
 *
 * Nothing here trusts the webhook body. Whatever arrives, the order is built
 * from a fresh Order/Details call against Fastrr — that payload decides what the
 * buyer bought and what they paid, because it is the only version of those facts
 * that an attacker POSTing to our webhook URL cannot forge.
 *
 * GST: our catalog is published to Fastrr at the buyer-facing price, and Fastrr
 * charges exactly that — it never adds tax on top the way the native checkout
 * does. So tax is extracted *out of* the amount collected rather than added to
 * it. Same rupees to the buyer, correct split for the invoice and settlements.
 */
export type FastrrSyncSource = 'webhook' | 'callback' | 'sweep';
export interface FastrrSyncResult {
    /** Our order id, once one exists. */
    orderId: string | null;
    status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'UNKNOWN_SESSION';
    /** Safe to show a buyer. */
    message: string;
}
export declare class FastrrOrderService {
    /**
     * Bring our database in line with Fastrr's view of one checkout.
     *
     * Safe to call repeatedly and from anywhere; it is a no-op once the order
     * exists, and never throws for the ordinary "buyer has not finished yet"
     * case — a webhook handler that threw on that would make Fastrr retry
     * forever.
     */
    syncFromFastrr(fastrrOrderId: string, source: FastrrSyncSource): Promise<FastrrSyncResult>;
    /**
     * The failsafe Fastrr's own documentation asks for.
     *
     * Webhooks get lost, and a buyer who closes the tab before the redirect never
     * triggers the callback poll either. Left alone, that is a paid order that
     * never exists here — the single worst outcome in this integration. So every
     * INITIATED session that is old enough to have resolved one way or the other
     * is asked about directly.
     *
     * Sessions past the give-up window are marked EXPIRED so the sweep does not
     * grow unboundedly; abandoned overlays are by far the common case and cost
     * nothing, since no stock was held for them.
     */
    reconcilePendingSessions(): Promise<{
        checked: number;
        placed: number;
        expired: number;
    }>;
    private materialize;
    /**
     * COD confirmation: the seller ships, so the order and its settlement are
     * real, but no money has moved. Deliberately does *not* route through
     * handlePaymentSuccess — that would flip the payment to SUCCESS and tell the
     * ledger funds had been received.
     */
    private confirmCodOrder;
    /**
     * Map Fastrr's variant ids back onto our catalog.
     *
     * Fastrr speaks in the numeric `external_id` surrogate the catalog feed
     * publishes, never our CUIDs. An id we cannot resolve means we would be
     * shipping something we cannot identify, so it stops the order.
     */
    private resolveLines;
    private markFailed;
    /** Best-effort cache and live-update fanout; never blocks a placed order. */
    private invalidate;
}
export declare const fastrrOrderService: FastrrOrderService;
//# sourceMappingURL=fastrr-order.service.d.ts.map