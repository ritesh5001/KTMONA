import { logger } from '../config/logger.js';
import { inventoryReserveFailTotal, integrityMismatchTotal, paymentFailTotal, } from '../config/metrics.js';
/**
 * Alert Conditions Module
 *
 * Defines in-process alert triggers that log at FATAL / WARN level
 * so they can be picked up by external alerting pipelines (PagerDuty,
 * Opsgenie, CloudWatch Alarms, Grafana Alert Rules, etc.).
 *
 * These are **in-app heuristics**; for production, pair with Prometheus
 * alerting rules that query the counters directly.
 *
 * Alert triggers:
 *   1. reserve_fail_rate > 20% in rolling 5-minute window
 *   2. integrity_mismatch_detected  (any severity)
 *   3. negative_stock_detected      (CRITICAL mismatch)
 *   4. payment_fail_spike           (> 10 failures in 5 min)
 */
const alertLogger = logger.child({ module: 'alerts' });
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const reserveAttempts = { timestamps: [] };
const reserveFailures = { timestamps: [] };
const paymentFailures = { timestamps: [] };
function pruneWindow(w) {
    const cutoff = Date.now() - WINDOW_MS;
    // Remove entries older than the window
    while (w.timestamps.length > 0 && w.timestamps[0] < cutoff) {
        w.timestamps.shift();
    }
}
// ─── Public API ─────────────────────────────────────────────────────
/**
 * Record a reserve attempt. Call on every checkout item reservation try.
 */
export function recordReserveAttempt() {
    reserveAttempts.timestamps.push(Date.now());
}
/**
 * Record a reserve failure. Evaluates the rolling fail rate alert.
 */
export function recordReserveFailure(variantId) {
    reserveFailures.timestamps.push(Date.now());
    inventoryReserveFailTotal.inc({ variantId });
    pruneWindow(reserveAttempts);
    pruneWindow(reserveFailures);
    const attempts = reserveAttempts.timestamps.length;
    const failures = reserveFailures.timestamps.length;
    if (attempts >= 10) { // only alert with sufficient sample size
        const failRate = failures / attempts;
        if (failRate > 0.2) {
            alertLogger.fatal({
                alert: 'reserve_fail_rate_high',
                failRate: Math.round(failRate * 100),
                failures,
                attempts,
                windowMs: WINDOW_MS,
            }, `ALERT: Reserve fail rate ${Math.round(failRate * 100)}% exceeds 20% threshold (${failures}/${attempts} in 5 min)`);
        }
    }
}
/**
 * Record integrity mismatch from the integrity check job.
 */
export function recordIntegrityMismatch(severity, variantId, reason) {
    integrityMismatchTotal.inc({ severity });
    if (severity === 'CRITICAL') {
        alertLogger.fatal({
            alert: 'negative_stock_detected',
            variantId,
            reason,
        }, `ALERT: Negative stock detected for variant ${variantId}`);
    }
    else {
        alertLogger.warn({
            alert: 'integrity_mismatch_detected',
            severity,
            variantId,
            reason,
        }, `ALERT: Integrity mismatch (${severity}) for variant ${variantId}: ${reason}`);
    }
}
/**
 * Record a payment failure. Evaluates the payment spike alert.
 */
export function recordPaymentFailure() {
    paymentFailures.timestamps.push(Date.now());
    paymentFailTotal.inc();
    pruneWindow(paymentFailures);
    if (paymentFailures.timestamps.length > 10) {
        alertLogger.fatal({
            alert: 'payment_fail_spike',
            failures: paymentFailures.timestamps.length,
            windowMs: WINDOW_MS,
        }, `ALERT: Payment failure spike — ${paymentFailures.timestamps.length} failures in 5 min window`);
    }
}
/**
 * Fatal cancellation safety alert.
 */
export function recordCancellationFatal(context) {
    alertLogger.fatal({
        alert: 'cancellation_safety_failure',
        ...context,
    }, `ALERT: Cancellation safety failure - ${context.reason}`);
}
/**
 * Fatal return/RMA safety alert.
 */
export function recordReturnFatal(context) {
    alertLogger.fatal({
        alert: 'return_safety_failure',
        ...context,
    }, `ALERT: Return safety failure - ${context.reason}`);
}
//# sourceMappingURL=alerts.js.map