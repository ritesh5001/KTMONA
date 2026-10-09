/**
 * Seller payout runs: settlements due 7 days after delivery plus open ledger
 * entries (ads, penalties, claim credits), paid as one bank transfer per seller.
 */
import { Prisma } from '@prisma/client';
interface DueSeller {
    sellerId: string;
    sellerCode: string;
    storeName: string | null;
    settlementIds: string[];
    settlementsAmount: number;
    ledgerIds: string[];
    ledgerAmount: number;
    amount: number;
    oldestDueDate: Date | null;
    onHold: boolean;
    holdReason: string | null;
    bank: {
        bankName: string;
        holderName: string;
        accountNumber: string;
        ifsc: string;
    } | null;
}
declare class AdminPayoutsService {
    /** Everything payable right now, grouped by seller. */
    due(opts?: {
        includeNotDue?: boolean;
    }): Promise<DueSeller[]>;
    dueSummary(): Promise<{
        paymentCycleDays: number;
        totals: {
            payableAmount: number;
            payableSellers: number;
            onHoldAmount: number;
            missingBank: number;
            negativeBalances: number;
        };
        sellers: {
            bank: {
                accountNumber: string;
                bankName: string;
                holderName: string;
                ifsc: string;
            } | null;
            status: string;
            sellerId: string;
            sellerCode: string;
            storeName: string | null;
            settlementIds: string[];
            settlementsAmount: number;
            ledgerIds: string[];
            ledgerAmount: number;
            amount: number;
            oldestDueDate: Date | null;
            onHold: boolean;
            holdReason: string | null;
        }[];
    }>;
    /** Mark one seller's due balance as paid (after the bank transfer is made). */
    pay(adminId: string, sellerId: string, input: {
        reference: string;
        method?: string | undefined;
        note?: string | undefined;
        expectedAmount?: number | undefined;
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
        id: string;
        payoutNumber: string;
        sellerId: string;
        amount: number;
        settlementsAmount: number;
        ledgerAmount: number;
        settlementCount: number;
        ledgerCount: number;
        method: string;
        reference: string | null;
        note: string | null;
        bankSnapshot: Prisma.JsonValue | null;
        createdBy: string;
        createdAt: Date;
    }, unknown> & {}>;
    history(query: Record<string, unknown>): Promise<{
        totalPaid: number;
        payouts: {
            storeName: string | null;
            method: string;
            id: string;
            createdAt: Date;
            sellerId: string;
            amount: number;
            note: string | null;
            payoutNumber: string;
            settlementsAmount: number;
            ledgerAmount: number;
            settlementCount: number;
            ledgerCount: number;
            reference: string | null;
            bankSnapshot: Prisma.JsonValue;
            createdBy: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /** Bulk bank-transfer sheet for everything payable now. */
    bankFileCsv(): Promise<string>;
}
export declare const adminPayoutsService: AdminPayoutsService;
export {};
//# sourceMappingURL=payouts.service.d.ts.map