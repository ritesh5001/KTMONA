/**
 * Shared helpers for the seller center (Meesho-style supplier panel).
 */
/** Must match commission.service.ts so previews equal real settlements. */
export declare const DEFAULT_COMMISSION_PCT = 10;
export declare const DEFAULT_PLATFORM_FEE = 0;
/** Seller must hand the parcel over within this window after the order. */
export declare const DISPATCH_SLA_HOURS = 48;
/** Payout is released this many days after delivery (Meesho-style cycle). */
export declare const PAYMENT_CYCLE_DAYS = 7;
export declare const LOW_STOCK_THRESHOLD = 5;
export declare function round2(value: number): number;
export declare function addHours(date: Date, hours: number): Date;
export declare function addDays(date: Date, days: number): Date;
export declare function startOfDay(date?: Date): Date;
/** UTC calendar day, for @db.Date columns. */
export declare function utcDay(date?: Date): Date;
export declare function dispatchBy(orderCreatedAt: Date): Date;
/** Short, human-facing seller ID shown in the panel header (e.g. KTM8F3A21). */
export declare function sellerCode(sellerId: string): string;
export declare function pctChange(current: number, previous: number): number | null;
export interface CommissionTerms {
    commissionPct: number;
    platformFee: number;
}
/**
 * The commission a seller pays. Mirrors commission.service.ts, which settles
 * orders from SellerCommissionConfig with a 10% fallback, so the "you will
 * earn" preview is exactly what the payout will be.
 */
export declare function getCommissionTerms(sellerId: string): Promise<CommissionTerms>;
/** Net payout for one unit sold at `sellerPrice`. Platform fee is per order. */
export declare function earningsFor(sellerPrice: number, terms: CommissionTerms): {
    sellerPrice: number;
    commission: number;
    platformFee: number;
    net: number;
};
export declare function parsePage(value: unknown, fallback?: number): number;
export declare function parseLimit(value: unknown, fallback?: number, max?: number): number;
/** CSV cell escaping for statement exports. */
export declare function csvCell(value: unknown): string;
export declare function toCsv(header: string[], rows: unknown[][]): string;
/** Drop undefined keys (for Prisma writes under exactOptionalPropertyTypes). */
export declare function compact<T extends Record<string, unknown>>(obj: T): {
    [K in keyof T]: Exclude<T[K], undefined>;
};
//# sourceMappingURL=common.d.ts.map