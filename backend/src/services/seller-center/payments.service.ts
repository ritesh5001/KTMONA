/**
 * Seller payments: Meesho-style payment cycle (paid 7 days after delivery),
 * per-order breakdown, deductions/credits ledger and downloadable statements.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { PAYMENT_CYCLE_DAYS, addDays, parseLimit, parsePage, round2, startOfDay, toCsv } from './common.js';

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

class SellerPaymentsService {
    private async rows(sellerId: string, where: Prisma.SellerSettlementWhereInput = {}): Promise<Row[]> {
        const settlements = await prisma.sellerSettlement.findMany({
            where: { sellerId, ...where },
            include: {
                order: {
                    select: {
                        id: true,
                        createdAt: true,
                        status: true,
                        shipments: { where: { seller_id: sellerId }, select: { status: true, delivered_at: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return settlements.map((s) => {
            const shipment = s.order.shipments[0] ?? null;
            const deliveredAt = shipment?.status === 'DELIVERED' ? shipment.delivered_at : null;
            const cancelled = s.status === 'CANCELLED' || s.order.status === 'CANCELLED' || shipment?.status?.startsWith('RTO');
            const bucket: Bucket = s.status === 'PAID' ? 'paid' : cancelled ? 'cancelled' : deliveredAt ? 'upcoming' : 'outstanding';
            return {
                settlementId: s.id,
                orderId: s.orderId,
                orderDate: s.order.createdAt,
                gross: s.grossAmount,
                commission: s.commissionAmount,
                platformFee: s.platformFee,
                net: s.netAmount,
                settlementStatus: s.status,
                shipmentStatus: shipment?.status ?? null,
                deliveredAt,
                payableOn: deliveredAt ? addDays(deliveredAt, PAYMENT_CYCLE_DAYS) : null,
                paidAt: s.status === 'PAID' ? s.settledAt : null,
                bucket,
            };
        });
    }

    async summary(sellerId: string) {
        const [rows, ledger, profile] = await Promise.all([
            this.rows(sellerId),
            prisma.sellerLedgerEntry.findMany({ where: { sellerId, waivedAt: null }, orderBy: { createdAt: 'desc' } }),
            prisma.seller_profiles.findUnique({ where: { user_id: sellerId }, select: { payout_hold: true, payout_hold_reason: true } }),
        ]);
        const sum = (list: Row[]) => round2(list.reduce((s, r) => s + r.net, 0));
        const upcoming = rows.filter((r) => r.bucket === 'upcoming');
        const outstanding = rows.filter((r) => r.bucket === 'outstanding');
        const paid = rows.filter((r) => r.bucket === 'paid');

        const today = startOfDay();
        const due = upcoming.filter((r) => r.payableOn && r.payableOn <= addDays(today, 1));
        const nextDate = upcoming
            .map((r) => r.payableOn!)
            .filter((d) => d >= today)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
        const nextAmount = nextDate
            ? sum(upcoming.filter((r) => r.payableOn && startOfDay(r.payableOn).getTime() === startOfDay(nextDate).getTime()))
            : 0;

        const openLedger = ledger.filter((l) => !l.settledAt);
        const ledgerTotals = {
            adSpend: round2(openLedger.filter((l) => l.type === 'AD_SPEND').reduce((s, l) => s + l.amount, 0)),
            penalties: round2(openLedger.filter((l) => l.type === 'PENALTY').reduce((s, l) => s + l.amount, 0)),
            claimCredits: round2(openLedger.filter((l) => l.type === 'CLAIM_CREDIT').reduce((s, l) => s + l.amount, 0)),
            adjustments: round2(openLedger.filter((l) => l.type === 'ADJUSTMENT').reduce((s, l) => s + l.amount, 0)),
        };
        const openLedgerNet = round2(openLedger.reduce((s, l) => s + l.amount, 0));

        // Last 6 weeks of payouts for the chart.
        const weeks = Array.from({ length: 6 }, (_, i) => {
            const end = addDays(today, -7 * i + 1);
            const start = addDays(end, -7);
            const inRange = paid.filter((r) => r.paidAt && r.paidAt >= start && r.paidAt < end);
            return { weekStart: start, amount: sum(inRange), orders: inRange.length };
        }).reverse();

        return {
            payoutHold: profile?.payout_hold ? { reason: profile.payout_hold_reason } : null,
            paymentCycleDays: PAYMENT_CYCLE_DAYS,
            upcoming: { amount: sum(upcoming), orders: upcoming.length },
            dueNow: { amount: sum(due), orders: due.length },
            nextPayout: { date: nextDate, amount: nextAmount },
            outstanding: { amount: sum(outstanding), orders: outstanding.length },
            paid: { amount: sum(paid), orders: paid.length, lastPaidAt: paid.map((r) => r.paidAt).filter(Boolean).sort().at(-1) ?? null },
            ledger: ledgerTotals,
            netPayable: round2(sum(upcoming) + openLedgerNet),
            totals: {
                gross: round2(rows.filter((r) => r.bucket !== 'cancelled').reduce((s, r) => s + r.gross, 0)),
                commission: round2(rows.filter((r) => r.bucket !== 'cancelled').reduce((s, r) => s + r.commission, 0)),
                platformFee: round2(rows.filter((r) => r.bucket !== 'cancelled').reduce((s, r) => s + r.platformFee, 0)),
            },
            weeklyPayouts: weeks,
        };
    }

    async orders(sellerId: string, query: Record<string, unknown>) {
        const bucket = ['upcoming', 'outstanding', 'paid', 'cancelled'].includes(String(query.bucket)) ? (query.bucket as Bucket) : null;
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25);
        const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
        let rows = await this.rows(sellerId);
        if (bucket) rows = rows.filter((r) => r.bucket === bucket);
        if (search) rows = rows.filter((r) => r.orderId.toLowerCase().includes(search));
        return {
            rows: rows.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
        };
    }

    async ledger(sellerId: string, query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25);
        const where: Prisma.SellerLedgerEntryWhereInput = { sellerId };
        const [total, entries] = await Promise.all([
            prisma.sellerLedgerEntry.count({ where }),
            prisma.sellerLedgerEntry.findMany({ where, orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
        ]);
        return { entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    /** CSV statement of order settlements and ledger entries in a date range. */
    async statementCsv(sellerId: string, from: Date, to: Date): Promise<string> {
        const range = { gte: startOfDay(from), lt: addDays(startOfDay(to), 1) };
        const [rows, ledger] = await Promise.all([
            this.rows(sellerId, { createdAt: range }),
            prisma.sellerLedgerEntry.findMany({ where: { sellerId, createdAt: range, waivedAt: null }, orderBy: { createdAt: 'asc' } }),
        ]);
        const header = ['Type', 'Date', 'Order ID', 'Reference', 'Gross (Rs)', 'Commission (Rs)', 'Platform fee (Rs)', 'Net (Rs)', 'Status', 'Delivered on', 'Payable on', 'Paid on'];
        const body: unknown[][] = [
            ...rows.map((r) => [
                'Order', r.orderDate.toISOString().slice(0, 10), r.orderId, r.settlementId, r.gross, r.commission, r.platformFee, r.net,
                r.bucket.toUpperCase(), r.deliveredAt?.toISOString().slice(0, 10) ?? '', r.payableOn?.toISOString().slice(0, 10) ?? '', r.paidAt?.toISOString().slice(0, 10) ?? '',
            ]),
            ...ledger.map((l) => [
                l.type.replace('_', ' '), l.createdAt.toISOString().slice(0, 10), l.orderId ?? '', l.note ?? l.referenceId ?? '', '', '', '', l.amount,
                l.settledAt ? 'SETTLED' : 'OPEN', '', '', l.settledAt?.toISOString().slice(0, 10) ?? '',
            ]),
        ];
        const totalNet = round2(rows.filter((r) => r.bucket !== 'cancelled').reduce((s, r) => s + r.net, 0) + ledger.reduce((s, l) => s + l.amount, 0));
        body.push([], ['Total net', '', '', '', '', '', '', totalNet]);
        return toCsv(header, body);
    }
}

export const sellerPaymentsService = new SellerPaymentsService();
