/**
 * Shared helpers for the seller center (Meesho-style supplier panel).
 */

import { prisma } from '../../config/db.js';

/** Must match commission.service.ts so previews equal real settlements. */
export const DEFAULT_COMMISSION_PCT = 10;
export const DEFAULT_PLATFORM_FEE = 0;

/** Seller must hand the parcel over within this window after the order. */
export const DISPATCH_SLA_HOURS = 48;

/** Payout is released this many days after delivery (Meesho-style cycle). */
export const PAYMENT_CYCLE_DAYS = 7;

export const LOW_STOCK_THRESHOLD = 5;

export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 3_600_000);
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86_400_000);
}

export function startOfDay(date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** UTC calendar day, for @db.Date columns. */
export function utcDay(date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dispatchBy(orderCreatedAt: Date): Date {
    return addHours(orderCreatedAt, DISPATCH_SLA_HOURS);
}

/** Short, human-facing seller ID shown in the panel header (e.g. KTM8F3A21). */
export function sellerCode(sellerId: string): string {
    return `KTM${sellerId.slice(-6).toUpperCase()}`;
}

export function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return round2(((current - previous) / previous) * 100);
}

export interface CommissionTerms {
    commissionPct: number;
    platformFee: number;
}

/**
 * The commission a seller pays. Mirrors commission.service.ts, which settles
 * orders from SellerCommissionConfig with a 10% fallback, so the "you will
 * earn" preview is exactly what the payout will be.
 */
export async function getCommissionTerms(sellerId: string): Promise<CommissionTerms> {
    const config = await prisma.sellerCommissionConfig.findUnique({ where: { sellerId } });
    return {
        commissionPct: config ? Number(config.commissionPct) : DEFAULT_COMMISSION_PCT,
        platformFee: config ? Number(config.platformFee) : DEFAULT_PLATFORM_FEE,
    };
}

/** Net payout for one unit sold at `sellerPrice`. Platform fee is per order. */
export function earningsFor(sellerPrice: number, terms: CommissionTerms) {
    const commission = round2((sellerPrice * terms.commissionPct) / 100);
    const net = round2(Math.max(0, sellerPrice - commission - terms.platformFee));
    return { sellerPrice: round2(sellerPrice), commission, platformFee: terms.platformFee, net };
}

export function parsePage(value: unknown, fallback = 1): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function parseLimit(value: unknown, fallback = 20, max = 100): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), max) : fallback;
}

/** CSV cell escaping for statement exports. */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
    return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Drop undefined keys (for Prisma writes under exactOptionalPropertyTypes). */
export function compact<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as never;
}
