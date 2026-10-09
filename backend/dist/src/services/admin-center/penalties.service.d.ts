/**
 * Seller penalty rules, the dispatch-SLA board and auto-cancellation.
 * Rules live in AppSetting so admins can change them without a deploy.
 */
export declare const PENALTY_KEYS: {
    readonly lateDispatch: "seller.late_dispatch_penalty";
    readonly autoCancelHours: "seller.auto_cancel_after_hours";
    readonly autoCancelPenalty: "seller.auto_cancel_penalty";
    readonly sellerCancelPenalty: "seller.seller_cancel_penalty";
};
export interface PenaltyRules {
    lateDispatchPenalty: number;
    /** Hours past the dispatch date before an unshipped order is auto-cancelled. 0 = off. */
    autoCancelAfterHours: number;
    autoCancelPenalty: number;
    sellerCancelPenalty: number;
}
export declare function getPenaltyRules(): Promise<PenaltyRules>;
/** Record a penalty once per (seller, order, reason). Returns false if it already existed. */
export declare function chargePenalty(sellerId: string, orderId: string, amount: number, note: string): Promise<boolean>;
declare class AdminPenaltiesService {
    rules(): Promise<PenaltyRules>;
    saveRules(input: Partial<PenaltyRules>): Promise<PenaltyRules>;
    /** All penalties across sellers, newest first. */
    list(query: Record<string, unknown>): Promise<{
        totalCharged: number;
        entries: {
            storeName: string | null;
            type: import(".prisma/client").SellerLedgerType;
            id: string;
            createdAt: Date;
            sellerId: string;
            orderId: string | null;
            settledAt: Date | null;
            payoutId: string | null;
            amount: number;
            note: string | null;
            referenceId: string | null;
            entryDate: Date;
            waivedAt: Date | null;
            waivedBy: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    addManual(adminId: string, input: {
        sellerId: string;
        amount: number;
        note: string;
        orderId?: string | undefined;
        type: 'PENALTY' | 'ADJUSTMENT';
    }): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    }, unknown> & {}>;
    waive(adminId: string, entryId: string): Promise<import("@prisma/client/runtime/index.js").GetResult<{
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
    }, unknown> & {}>;
    /** Orders that have not been dispatched in time, across all sellers. */
    slaBoard(query: Record<string, unknown>): Promise<{
        rules: PenaltyRules;
        rows: {
            storeName: string | null;
            willAutoCancel: boolean;
            orderId: string;
            sellerId: string;
            orderDate: Date;
            dispatchBy: Date;
            hoursOverdue: number;
            stage: string;
            amount: number;
        }[];
    }>;
    /**
     * Auto-cancel sub-orders not dispatched `autoCancelAfterHours` after their
     * dispatch date (Meesho-style). Single-seller orders are fully cancelled and
     * refunded; the seller is charged the auto-cancel penalty.
     */
    runAutoCancel(): Promise<{
        cancelled: number;
    }>;
}
export declare function storeNames(sellerIds: string[]): Promise<Map<string, string>>;
export declare const adminPenaltiesService: AdminPenaltiesService;
export {};
//# sourceMappingURL=penalties.service.d.ts.map