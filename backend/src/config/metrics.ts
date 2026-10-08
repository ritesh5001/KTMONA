import client from 'prom-client';

/**
 * Prometheus-compatible metrics registry.
 *
 * Exposed via GET /metrics for scraping by Prometheus / Grafana / Datadog.
 * All counters follow the naming convention: `domain_event_total`.
 */

// Use the default global registry
export const register = client.register;

// Collect Node.js runtime metrics (GC, event loop, memory, etc.)
client.collectDefaultMetrics({ register });

// ─── Inventory ──────────────────────────────────────────────────────

export const inventoryReserveAttemptTotal = new client.Counter({
    name: 'inventory_reserve_attempt_total',
    help: 'Total inventory reserve attempts',
    labelNames: ['variantId'] as const,
});

export const inventoryReserveFailTotal = new client.Counter({
    name: 'inventory_reserve_fail_total',
    help: 'Total inventory reserve failures (out of stock)',
    labelNames: ['variantId'] as const,
});

// ─── Checkout ───────────────────────────────────────────────────────

export const checkoutSuccessTotal = new client.Counter({
    name: 'checkout_success_total',
    help: 'Total successful checkouts',
});

export const checkoutFailTotal = new client.Counter({
    name: 'checkout_fail_total',
    help: 'Total failed checkouts (any reason)',
    labelNames: ['reason'] as const,
});

// ─── Payment ────────────────────────────────────────────────────────

export const paymentSuccessTotal = new client.Counter({
    name: 'payment_success_total',
    help: 'Total successful payments',
});

export const paymentFailTotal = new client.Counter({
    name: 'payment_fail_total',
    help: 'Total failed payments',
});

// ─── Stale Orders ───────────────────────────────────────────────────

export const staleCancelTotal = new client.Counter({
    name: 'stale_cancel_total',
    help: 'Total stale orders cancelled',
});

// ─── Integrity ──────────────────────────────────────────────────────

export const integrityMismatchTotal = new client.Counter({
    name: 'integrity_mismatch_total',
    help: 'Total inventory integrity mismatches detected',
    labelNames: ['severity'] as const,
});

// ─── HTTP request duration (optional, useful for SLA monitoring) ────

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// ─── Wishlist ───────────────────────────────────────────────────────

export const wishlistAddTotal = new client.Counter({
    name: 'wishlist_add_total',
    help: 'Total products added to wishlists',
});

export const wishlistRemoveTotal = new client.Counter({
    name: 'wishlist_remove_total',
    help: 'Total products removed from wishlists',
});

// ─── Search ─────────────────────────────────────────────────────────

export const searchQueryTotal = new client.Counter({
    name: 'search_query_total',
    help: 'Total full-text search queries executed',
});

export const searchNoResultTotal = new client.Counter({
    name: 'search_no_result_total',
    help: 'Total search queries returning zero results',
});

export const autocompleteTotal = new client.Counter({
    name: 'autocomplete_total',
    help: 'Total autocomplete suggestion requests',
});

export const searchDurationSeconds = new client.Histogram({
    name: 'search_duration_seconds',
    help: 'Duration of search queries in seconds',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// ─── Personalization ────────────────────────────────────────────────

export const recentlyViewedTrackTotal = new client.Counter({
    name: 'recently_viewed_track_total',
    help: 'Total recently-viewed tracking events',
});

export const recentlyViewedFetchTotal = new client.Counter({
    name: 'recently_viewed_fetch_total',
    help: 'Total recently-viewed list fetch requests',
});

export const recommendationRequestTotal = new client.Counter({
    name: 'recommendation_request_total',
    help: 'Total recommendation generation requests',
});

export const recommendationGenerationTimeMs = new client.Histogram({
    name: 'recommendation_generation_time_ms',
    help: 'Recommendation generation time in milliseconds',
    buckets: [5, 10, 20, 35, 50, 75, 100, 150, 250, 500],
});

export const recommendationCandidateCount = new client.Histogram({
    name: 'recommendation_candidate_count',
    help: 'Candidate product count considered per recommendation request',
    buckets: [0, 5, 10, 20, 40, 60, 80, 120, 200],
});

// ─── Cancellation & Refunds ─────────────────────────────────────────

export const orderCancelRequestTotal = new client.Counter({
    name: 'order_cancel_request_total',
    help: 'Total order cancellation requests raised by buyers',
});

// ─── GST ────────────────────────────────────────────────────────────

export const gstCalculationTotal = new client.Counter({
    name: 'gst_calculation_total',
    help: 'Total GST calculations performed during checkout',
});

export const igstAppliedTotal = new client.Counter({
    name: 'igst_applied_total',
    help: 'Total inter-state (IGST) order items',
});

export const intraStateOrderTotal = new client.Counter({
    name: 'intra_state_order_total',
    help: 'Total intra-state (CGST+SGST) order items',
});

export const orderCancelTotal = new client.Counter({
    name: 'order_cancel_total',
    help: 'Total order cancellation lifecycle events requested by buyers',
});

export const orderCancelApprovedTotal = new client.Counter({
    name: 'order_cancel_approved_total',
    help: 'Total order cancellation requests approved by admins',
});

export const orderCancelRejectedTotal = new client.Counter({
    name: 'order_cancel_rejected_total',
    help: 'Total order cancellation requests rejected by admins',
});

export const refundSuccessTotal = new client.Counter({
    name: 'refund_success_total',
    help: 'Total successful refunds triggered after cancellation approval',
});

// ─── Returns / RMA ──────────────────────────────────────────────────

export const returnRequestTotal = new client.Counter({
    name: 'return_request_total',
    help: 'Total return/RMA requests raised by buyers',
});

export const returnApprovedTotal = new client.Counter({
    name: 'return_approved_total',
    help: 'Total return requests approved by admins',
});

export const returnRejectedTotal = new client.Counter({
    name: 'return_rejected_total',
    help: 'Total return requests rejected by admins',
});

export const returnRefundedTotal = new client.Counter({
    name: 'return_refunded_total',
    help: 'Total return requests with successful refund',
});

export const returnProcessingTimeMs = new client.Histogram({
    name: 'return_processing_time_ms',
    help: 'Return request processing time from creation to refund (ms)',
    buckets: [100, 500, 1000, 2500, 5000, 10000, 30000, 60000],
});

// ── Invoice Metrics ──────────────────────────────────────────────

export const invoiceGeneratedTotal = new client.Counter({
    name: 'invoice_generated_total',
    help: 'Total invoices generated (PDF rendered)',
});

export const invoiceDownloadTotal = new client.Counter({
    name: 'invoice_download_total',
    help: 'Total invoice PDF downloads by buyers',
});

// ── Refund Ledger Metrics ────────────────────────────────────────

export const refundCreatedTotal = new client.Counter({
    name: 'refund_created_total',
    help: 'Total refund ledger entries created',
});

export const refundLedgerSuccessTotal = new client.Counter({
    name: 'refund_ledger_success_total',
    help: 'Total refunds that succeeded via payment provider',
});

export const refundFailedTotal = new client.Counter({
    name: 'refund_failed_total',
    help: 'Total refunds that failed at the payment provider',
});

export const refundOverLimitRejectedTotal = new client.Counter({
    name: 'refund_over_limit_rejected_total',
    help: 'Total refund attempts rejected due to exceeding order total',
});

// ── Seller Commission Metrics ────────────────────────────────────

export const sellerSettlementCreatedTotal = new client.Counter({
    name: 'seller_settlement_created_total',
    help: 'Total seller settlement rows created',
});

export const sellerSettlementAmountTotal = new client.Counter({
    name: 'seller_settlement_amount_total',
    help: 'Total gross settlement amount (INR)',
});

export const commissionAmountTotal = new client.Counter({
    name: 'commission_amount_total',
    help: 'Total commission earned by platform (INR)',
});

// ── Coupon / Promocode Metrics ───────────────────────────────────

export const couponAppliedTotal = new client.Counter({
    name: 'coupon_applied_total',
    help: 'Total successful coupon applications',
});

export const couponRejectedTotal = new client.Counter({
    name: 'coupon_rejected_total',
    help: 'Total rejected coupon applications',
});

export const couponUsageExhaustedTotal = new client.Counter({
    name: 'coupon_usage_exhausted_total',
    help: 'Total coupon applications rejected because usage limit was exhausted',
});

export const couponDiscountAmountTotal = new client.Counter({
    name: 'coupon_discount_amount_total',
    help: 'Total coupon discount amount applied (INR)',
});

// ── Hot Endpoint Performance ───────────────────────────────────────

export const hotEndpointDurationMs = new client.Histogram({
    name: 'hot_endpoint_duration_ms',
    help: 'Duration in milliseconds for high-traffic endpoints',
    labelNames: ['endpoint', 'method', 'status'] as const,
    buckets: [20, 50, 75, 100, 150, 200, 300, 500, 1000, 2000, 5000],
});

export const hotEndpointSlowTotal = new client.Counter({
    name: 'hot_endpoint_slow_total',
    help: 'Total slow requests observed on high-traffic endpoints',
    labelNames: ['endpoint', 'method'] as const,
});
