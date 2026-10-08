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
import { SettlementStatus } from '@prisma/client';
declare class CommissionService {
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
    calculateAndStoreSellerSettlement(orderId: string): Promise<void>;
    /**
     * List settlements with optional filters.
     */
    listSettlements(filters?: {
        sellerId?: string;
        orderId?: string;
        status?: SettlementStatus;
    }): Promise<{
        settlements: any[];
    }>;
}
export declare const commissionService: CommissionService;
export {};
//# sourceMappingURL=commission.service.d.ts.map