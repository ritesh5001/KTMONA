/**
 * Commission Service
 * Calculates platform commission per seller per order and stores immutable settlement snapshots.
 *
 * Safety rules:
 * - Settlement rows are immutable once created (no updates/deletes, only status transitions)
 * - Idempotent: skips if settlements already exist for the order
 * - No modifications to inventory, refund, or invoice logic
 * - Uses a transaction for atomicity across multiple seller settlements
 */

import { PaymentStatus, SettlementStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { commissionLogger } from '../config/logger.js';
import {
    sellerSettlementCreatedTotal,
    sellerSettlementAmountTotal,
    commissionAmountTotal,
} from '../config/metrics.js';
import { ApiError } from '../errors/ApiError.js';

// Default commission when no SellerCommissionConfig exists for a seller
const DEFAULT_COMMISSION_PCT = 10; // 10%
const DEFAULT_PLATFORM_FEE = 0;

class CommissionService {
    /**
     * Calculate and store seller settlements for every seller in the given order.
     *
     * High-level flow:
     * 1. Verify order's payment is SUCCESS
     * 2. Idempotency check — if settlements exist, return early
     * 3. Group order items by seller
     * 4. Fetch each seller's commission config (fallback to defaults)
     * 5. Compute gross, commission, platformFee, netAmount per seller
     * 6. Insert all SellerSettlement rows inside a transaction
     */
    async calculateAndStoreSellerSettlement(orderId: string): Promise<void> {
        // ── 1. Fetch order with payment + items ────────────────────────
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payment: true,
                items: true,
            },
        });

        if (!order) {
            commissionLogger.warn({ orderId }, 'Order not found for settlement calculation');
            throw new ApiError(404, `Order ${orderId} not found`);
        }

        if (!order.payment || order.payment.status !== PaymentStatus.SUCCESS) {
            commissionLogger.warn(
                { orderId, paymentStatus: order.payment?.status },
                'Skipping settlement — payment not SUCCESS',
            );
            return;
        }

        // ── 2. Idempotency — skip if settlements already exist ─────────
        const existing = await prisma.sellerSettlement.findFirst({
            where: { orderId },
        });

        if (existing) {
            commissionLogger.info({ orderId }, 'Settlements already exist, skipping');
            return;
        }

        // ── 3. Group order items by seller ─────────────────────────────
        const sellerItemsMap = new Map<
            string,
            { grossAmount: number }
        >();

        for (const item of order.items) {
            const current = sellerItemsMap.get(item.sellerId) ?? { grossAmount: 0 };
            const itemGross = item.sellerPriceSnapshot * item.quantity;
            current.grossAmount += itemGross;
            sellerItemsMap.set(item.sellerId, current);
        }

        // ── 4. Fetch commission configs for all sellers in bulk ────────
        const sellerIds = Array.from(sellerItemsMap.keys());
        const configs = await prisma.sellerCommissionConfig.findMany({
            where: { sellerId: { in: sellerIds } },
        });

        const configMap = new Map(configs.map((c) => [c.sellerId, c]));

        // ── 5. Compute settlements ─────────────────────────────────────
        const settlementsData = sellerIds.map((sellerId) => {
            const { grossAmount } = sellerItemsMap.get(sellerId)!;
            const config = configMap.get(sellerId);

            const commissionPct = config
                ? Number(config.commissionPct)
                : DEFAULT_COMMISSION_PCT;
            const platformFee = config
                ? Number(config.platformFee)
                : DEFAULT_PLATFORM_FEE;

            const commissionAmount = Math.round((grossAmount * commissionPct / 100) * 100) / 100;
            const rawNetAmount = Math.round((grossAmount - commissionAmount - platformFee) * 100) / 100;
            const netAmount = Math.max(0, rawNetAmount);

            return {
                orderId,
                sellerId,
                grossAmount: Math.round(grossAmount * 100) / 100,
                commissionAmount,
                platformFee,
                netAmount,
                status: 'PENDING' as SettlementStatus,
            };
        });

        // ── 6. Insert inside transaction (idempotent via unique constraint) ──
        try {
            const insertedCount = await prisma.$transaction(async (tx) => {
                // Double-check inside tx to prevent race
                const doubleCheck = await tx.sellerSettlement.findFirst({
                    where: { orderId },
                });
                if (doubleCheck) {
                    commissionLogger.info({ orderId }, 'Settlement race: another process already created rows');
                    return 0;
                }

                const created = await tx.sellerSettlement.createMany({
                    data: settlementsData,
                    skipDuplicates: true,
                });

                return created.count;
            });

            if (insertedCount === 0) {
                return;
            }

            // ── 7. Metrics ─────────────────────────────────────────────
            for (const s of settlementsData) {
                sellerSettlementCreatedTotal.inc();
                sellerSettlementAmountTotal.inc(s.grossAmount);
                commissionAmountTotal.inc(s.commissionAmount);
            }

            commissionLogger.info(
                {
                    orderId,
                    sellerCount: settlementsData.length,
                    settlements: settlementsData.map((s) => ({
                        sellerId: s.sellerId,
                        gross: s.grossAmount,
                        commission: s.commissionAmount,
                        net: s.netAmount,
                    })),
                },
                `Created ${settlementsData.length} seller settlement(s) for order ${orderId}`,
            );
        } catch (error: any) {
            // Unique constraint violation → another concurrent call already created the rows
            if (error?.code === 'P2002' || error?.code === 'P2034' || String(error?.message ?? '').includes('Unique constraint')) {
                commissionLogger.info({ orderId }, 'Settlement unique constraint hit — idempotent skip');
                return;
            }
            throw error;
        }
    }

    /**
     * List settlements with optional filters.
     */
    async listSettlements(filters: {
        sellerId?: string;
        orderId?: string;
        status?: SettlementStatus;
    } = {}): Promise<{ settlements: any[] }> {
        const where: any = {};
        if (filters.sellerId) where.sellerId = filters.sellerId;
        if (filters.orderId) where.orderId = filters.orderId;
        if (filters.status) where.status = filters.status;

        const settlements = await prisma.sellerSettlement.findMany({
            where,
            include: {
                order: { select: { id: true, totalAmount: true, status: true, invoiceNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return { settlements };
    }
}

export const commissionService = new CommissionService();
