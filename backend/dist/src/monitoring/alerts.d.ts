/**
 * Record a reserve attempt. Call on every checkout item reservation try.
 */
export declare function recordReserveAttempt(): void;
/**
 * Record a reserve failure. Evaluates the rolling fail rate alert.
 */
export declare function recordReserveFailure(variantId: string): void;
/**
 * Record integrity mismatch from the integrity check job.
 */
export declare function recordIntegrityMismatch(severity: 'CRITICAL' | 'WARNING' | 'INFO', variantId: string, reason: string): void;
/**
 * Record a payment failure. Evaluates the payment spike alert.
 */
export declare function recordPaymentFailure(): void;
/**
 * Fatal cancellation safety alert.
 */
export declare function recordCancellationFatal(context: {
    orderId?: string;
    cancellationId?: string;
    reason: string;
    adminId?: string;
    userId?: string;
}): void;
/**
 * Fatal return/RMA safety alert.
 */
export declare function recordReturnFatal(context: {
    orderId?: string;
    returnId?: string;
    reason: string;
    adminId?: string;
    userId?: string;
}): void;
//# sourceMappingURL=alerts.d.ts.map