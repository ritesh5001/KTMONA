/**
 * Seller payments: Meesho-style payment cycle (paid 7 days after delivery),
 * per-order breakdown, deductions/credits ledger and downloadable statements.
 */
type Bucket = 'upcoming' | 'outstanding' | 'paid' | 'cancelled';
interface Row {
    settlementId: string;
    orderId: string;
    orderDate: Date;
    gross: number;
    commission: number;
    platformFee: number;
    net: number;
    settlementStatus: string;
    shipmentStatus: string | null;
    deliveredAt: Date | null;
    payableOn: Date | null;
    paidAt: Date | null;
    bucket: Bucket;
}
declare class SellerPaymentsService {
    private rows;
    summary(sellerId: string): Promise<{
        payoutHold: {
            reason: string | null;
        } | null;
        paymentCycleDays: number;
        upcoming: {
            amount: number;
            orders: number;
        };
        dueNow: {
            amount: number;
            orders: number;
        };
        nextPayout: {
            date: Date | null;
            amount: number;
        };
        outstanding: {
            amount: number;
            orders: number;
        };
        paid: {
            amount: number;
            orders: number;
            lastPaidAt: Date | null;
        };
        ledger: {
            adSpend: number;
            penalties: number;
            claimCredits: number;
            adjustments: number;
        };
        netPayable: number;
        totals: {
            gross: number;
            commission: number;
            platformFee: number;
        };
        weeklyPayouts: {
            weekStart: Date;
            amount: number;
            orders: number;
        }[];
    }>;
    orders(sellerId: string, query: Record<string, unknown>): Promise<{
        rows: Row[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    ledger(sellerId: string, query: Record<string, unknown>): Promise<{
        entries: (import("@prisma/client/runtime/index.js").GetResult<{
            id: string;
            sellerId: string;
            type: import(".prisma/client").SellerLedgerType;
            amount: number;
            referenceId: string | null;
            orderId: string | null;
            note: string | null;
            entryDate: Date;
            settledAt: Date | null;
            payoutId: string | null;
            waivedAt: Date | null;
            waivedBy: string | null;
            createdAt: Date;
        }, unknown> & {})[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /** CSV statement of order settlements and ledger entries in a date range. */
    statementCsv(sellerId: string, from: Date, to: Date): Promise<string>;
}
export declare const sellerPaymentsService: SellerPaymentsService;
export {};
//# sourceMappingURL=payments.service.d.ts.map