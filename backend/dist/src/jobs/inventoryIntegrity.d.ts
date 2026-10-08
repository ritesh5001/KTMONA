/**
 * Inventory Integrity Check Job
 *
 * Compares `inventory.stock` against the sum of RESERVE/RELEASE movements
 * to detect drift caused by bugs, partial failures, or manual DB edits.
 *
 * Formula for expected stock:
 *   expectedStock = initialStock − Σ(RESERVE quantities) + Σ(RELEASE quantities)
 *
 * Since we don't track "initial stock at movement start", we use the inverse:
 *   For each variant that has movements, the NET reserved quantity is:
 *     netReserved = Σ(RESERVE) − Σ(RELEASE)
 *   The current stock should satisfy:
 *     stock >= 0  (never negative)
 *   And for PLACED/CONFIRMED orders, their RESERVE movements should have
 *   corresponding inventory decrements reflected in the stock.
 *
 * This job:
 *   1. Finds all variants with InventoryMovements.
 *   2. Computes netReserved = Σ RESERVE − Σ RELEASE per variant.
 *   3. Flags negative stock as CRITICAL.
 *   4. Flags netReserved < 0 (over-released) as WARNING.
 *   5. Returns a structured report for logging / alerting.
 *
 * Run via: npx tsx src/jobs/inventoryIntegrity.ts
 * Or import and call from a cron scheduler.
 */
export interface IntegrityMismatch {
    variantId: string;
    currentStock: number;
    totalReserved: number;
    totalReleased: number;
    totalDeducted: number;
    netReserved: number;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    reason: string;
}
export interface IntegrityReport {
    checkedAt: Date;
    variantsChecked: number;
    mismatches: IntegrityMismatch[];
    healthy: boolean;
}
export declare function runInventoryIntegrityCheck(): Promise<IntegrityReport>;
//# sourceMappingURL=inventoryIntegrity.d.ts.map