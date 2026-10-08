import client from 'prom-client';
/**
 * Prometheus-compatible metrics registry.
 *
 * Exposed via GET /metrics for scraping by Prometheus / Grafana / Datadog.
 * All counters follow the naming convention: `domain_event_total`.
 */
export declare const register: client.Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare const inventoryReserveAttemptTotal: client.Counter<"variantId">;
export declare const inventoryReserveFailTotal: client.Counter<"variantId">;
export declare const checkoutSuccessTotal: client.Counter<string>;
export declare const checkoutFailTotal: client.Counter<"reason">;
export declare const paymentSuccessTotal: client.Counter<string>;
export declare const paymentFailTotal: client.Counter<string>;
export declare const staleCancelTotal: client.Counter<string>;
export declare const integrityMismatchTotal: client.Counter<"severity">;
export declare const httpRequestDuration: client.Histogram<"status" | "route" | "method">;
export declare const wishlistAddTotal: client.Counter<string>;
export declare const wishlistRemoveTotal: client.Counter<string>;
export declare const searchQueryTotal: client.Counter<string>;
export declare const searchNoResultTotal: client.Counter<string>;
export declare const autocompleteTotal: client.Counter<string>;
export declare const searchDurationSeconds: client.Histogram<string>;
export declare const recentlyViewedTrackTotal: client.Counter<string>;
export declare const recentlyViewedFetchTotal: client.Counter<string>;
export declare const recommendationRequestTotal: client.Counter<string>;
export declare const recommendationGenerationTimeMs: client.Histogram<string>;
export declare const recommendationCandidateCount: client.Histogram<string>;
export declare const orderCancelRequestTotal: client.Counter<string>;
export declare const gstCalculationTotal: client.Counter<string>;
export declare const igstAppliedTotal: client.Counter<string>;
export declare const intraStateOrderTotal: client.Counter<string>;
export declare const orderCancelTotal: client.Counter<string>;
export declare const orderCancelApprovedTotal: client.Counter<string>;
export declare const orderCancelRejectedTotal: client.Counter<string>;
export declare const refundSuccessTotal: client.Counter<string>;
export declare const returnRequestTotal: client.Counter<string>;
export declare const returnApprovedTotal: client.Counter<string>;
export declare const returnRejectedTotal: client.Counter<string>;
export declare const returnRefundedTotal: client.Counter<string>;
export declare const returnProcessingTimeMs: client.Histogram<string>;
export declare const invoiceGeneratedTotal: client.Counter<string>;
export declare const invoiceDownloadTotal: client.Counter<string>;
export declare const refundCreatedTotal: client.Counter<string>;
export declare const refundLedgerSuccessTotal: client.Counter<string>;
export declare const refundFailedTotal: client.Counter<string>;
export declare const refundOverLimitRejectedTotal: client.Counter<string>;
export declare const sellerSettlementCreatedTotal: client.Counter<string>;
export declare const sellerSettlementAmountTotal: client.Counter<string>;
export declare const commissionAmountTotal: client.Counter<string>;
export declare const couponAppliedTotal: client.Counter<string>;
export declare const couponRejectedTotal: client.Counter<string>;
export declare const couponUsageExhaustedTotal: client.Counter<string>;
export declare const couponDiscountAmountTotal: client.Counter<string>;
export declare const hotEndpointDurationMs: client.Histogram<"status" | "method" | "endpoint">;
export declare const hotEndpointSlowTotal: client.Counter<"method" | "endpoint">;
//# sourceMappingURL=metrics.d.ts.map