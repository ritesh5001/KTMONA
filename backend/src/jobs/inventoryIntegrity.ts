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

import { prisma } from '../config/db.js';
import { integrityLogger } from '../config/logger.js';
import { recordIntegrityMismatch } from '../monitoring/alerts.js';

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

export async function runInventoryIntegrityCheck(): Promise<IntegrityReport> {
    const checkedAt = new Date();
    const mismatches: IntegrityMismatch[] = [];

    // 1. Aggregate RESERVE, RELEASE, and DEDUCT quantities per variant
    const reserveAgg = await prisma.inventoryMovement.groupBy({
        by: ['variantId'],
        where: { type: 'RESERVE' },
        _sum: { quantity: true },
    });

    const releaseAgg = await prisma.inventoryMovement.groupBy({
        by: ['variantId'],
        where: { type: 'RELEASE' },
        _sum: { quantity: true },
    });

    const deductAgg = await prisma.inventoryMovement.groupBy({
        by: ['variantId'],
        where: { type: 'DEDUCT' },
        _sum: { quantity: true },
    });

    // Build lookup maps
    const reserveMap = new Map<string, number>();
    for (const r of reserveAgg) {
        reserveMap.set(r.variantId, r._sum.quantity ?? 0);
    }

    const releaseMap = new Map<string, number>();
    for (const r of releaseAgg) {
        releaseMap.set(r.variantId, r._sum.quantity ?? 0);
    }

    const deductMap = new Map<string, number>();
    for (const r of deductAgg) {
        deductMap.set(r.variantId, r._sum.quantity ?? 0);
    }

    // 2. Get all variant IDs that have any movements
    const allVariantIds = new Set([...reserveMap.keys(), ...releaseMap.keys(), ...deductMap.keys()]);

    // 3. Fetch current stock for those variants
    const inventories = await prisma.inventory.findMany({
        where: { variantId: { in: [...allVariantIds] } },
    });

    const stockMap = new Map<string, number>();
    for (const inv of inventories) {
        stockMap.set(inv.variantId, inv.stock);
    }

    // 4. Check each variant
    for (const variantId of allVariantIds) {
        const currentStock = stockMap.get(variantId) ?? 0;
        const totalReserved = reserveMap.get(variantId) ?? 0;
        const totalReleased = releaseMap.get(variantId) ?? 0;
        const totalDeducted = deductMap.get(variantId) ?? 0;
        const netReserved = totalReserved - totalReleased - totalDeducted;

        // CRITICAL: stock went negative (should never happen with atomic guards)
        if (currentStock < 0) {
            mismatches.push({
                variantId,
                currentStock,
                totalReserved,
                totalReleased,
                totalDeducted,
                netReserved,
                severity: 'CRITICAL',
                reason: `Negative stock detected (${currentStock}). Possible race condition or manual override.`,
            });
            continue;
        }

        // WARNING: more released/deducted than reserved (over-release)
        if (netReserved < 0) {
            mismatches.push({
                variantId,
                currentStock,
                totalReserved,
                totalReleased,
                totalDeducted,
                netReserved,
                severity: 'WARNING',
                reason: `Over-release detected: released ${totalReleased} + deducted ${totalDeducted} > reserved ${totalReserved}.`,
            });
            continue;
        }

        // INFO: inventory row missing for a variant with movements
        if (!stockMap.has(variantId)) {
            mismatches.push({
                variantId,
                currentStock: 0,
                totalReserved,
                totalReleased,
                totalDeducted,
                netReserved,
                severity: 'WARNING',
                reason: `No inventory row found for variant with ${totalReserved} RESERVE, ${totalReleased} RELEASE, and ${totalDeducted} DEDUCT movements.`,
            });
        }
    }

    const report: IntegrityReport = {
        checkedAt,
        variantsChecked: allVariantIds.size,
        mismatches,
        healthy: mismatches.length === 0,
    };

    // Log summary
    if (report.healthy) {
        integrityLogger.info({
            event: 'inventory_integrity_check',
            variantsChecked: report.variantsChecked,
            healthy: true,
        }, `Integrity check: ${report.variantsChecked} variants — all healthy`);
    } else {
        for (const m of report.mismatches) {
            recordIntegrityMismatch(m.severity, m.variantId, m.reason);
            integrityLogger.warn({
                event: 'inventory_integrity_mismatch',
                severity: m.severity,
                variantId: m.variantId,
                currentStock: m.currentStock,
                totalReserved: m.totalReserved,
                totalReleased: m.totalReleased,
                totalDeducted: m.totalDeducted,
                netReserved: m.netReserved,
                reason: m.reason,
            }, `Integrity mismatch [${m.severity}] variant=${m.variantId}: ${m.reason}`);
        }
    }

    return report;
}

// ------------------------------------------------------------------
// CLI entry point — run directly with: npx tsx src/jobs/inventoryIntegrity.ts
// ------------------------------------------------------------------
if (process.argv[1]?.includes('inventoryIntegrity')) {
    runInventoryIntegrityCheck()
        .then((report) => {
            if (!report.healthy) {
                process.exitCode = 1;
            }
        })
        .catch((err) => {
            integrityLogger.fatal({ error: err instanceof Error ? err.message : String(err) }, 'Inventory integrity check fatal error');
            process.exitCode = 2;
        })
        .finally(() => prisma.$disconnect());
}
