/**
 * Seller penalty rules, the dispatch-SLA board and auto-cancellation.
 * Rules live in AppSetting so admins can change them without a deploy.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
import { cancellationService } from '../cancellation.service.js';
import { addHours, dispatchBy, parseLimit, parsePage, round2, utcDay } from '../seller-center/common.js';

const log = logger.child({ module: 'admin-penalties' });

export const PENALTY_KEYS = {
    lateDispatch: 'seller.late_dispatch_penalty',
    autoCancelHours: 'seller.auto_cancel_after_hours',
    autoCancelPenalty: 'seller.auto_cancel_penalty',
    sellerCancelPenalty: 'seller.seller_cancel_penalty',
} as const;

export interface PenaltyRules {
    lateDispatchPenalty: number;
    /** Hours past the dispatch date before an unshipped order is auto-cancelled. 0 = off. */
    autoCancelAfterHours: number;
    autoCancelPenalty: number;
    sellerCancelPenalty: number;
}

async function num(key: string): Promise<number> {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    const v = Number(row?.value ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function getPenaltyRules(): Promise<PenaltyRules> {
    const [lateDispatchPenalty, autoCancelAfterHours, autoCancelPenalty, sellerCancelPenalty] = await Promise.all([
        num(PENALTY_KEYS.lateDispatch),
        num(PENALTY_KEYS.autoCancelHours),
        num(PENALTY_KEYS.autoCancelPenalty),
        num(PENALTY_KEYS.sellerCancelPenalty),
    ]);
    return { lateDispatchPenalty, autoCancelAfterHours, autoCancelPenalty, sellerCancelPenalty };
}

/** Record a penalty once per (seller, order, reason). Returns false if it already existed. */
export async function chargePenalty(sellerId: string, orderId: string, amount: number, note: string): Promise<boolean> {
    if (!(amount > 0)) return false;
    const exists = await prisma.sellerLedgerEntry.findFirst({ where: { sellerId, type: 'PENALTY', orderId, note } });
    if (exists) return false;
    await prisma.sellerLedgerEntry.create({
        data: { sellerId, type: 'PENALTY', amount: -round2(amount), referenceId: `${orderId}:${note}`, orderId, note, entryDate: utcDay() },
    });
    return true;
}

class AdminPenaltiesService {
    async rules() {
        return getPenaltyRules();
    }

    async saveRules(input: Partial<PenaltyRules>) {
        const map: [keyof PenaltyRules, string][] = [
            ['lateDispatchPenalty', PENALTY_KEYS.lateDispatch],
            ['autoCancelAfterHours', PENALTY_KEYS.autoCancelHours],
            ['autoCancelPenalty', PENALTY_KEYS.autoCancelPenalty],
            ['sellerCancelPenalty', PENALTY_KEYS.sellerCancelPenalty],
        ];
        for (const [field, key] of map) {
            const value = input[field];
            if (value === undefined) continue;
            if (!(value >= 0) || value > 10_000) throw ApiError.badRequest(`${field} must be between 0 and 10000`);
            await prisma.appSetting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
        }
        return getPenaltyRules();
    }

    /** All penalties across sellers, newest first. */
    async list(query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 30);
        const sellerId = typeof query.sellerId === 'string' ? query.sellerId : undefined;
        const where: Prisma.SellerLedgerEntryWhereInput = { type: 'PENALTY', ...(sellerId ? { sellerId } : {}) };
        const [total, entries, sum] = await Promise.all([
            prisma.sellerLedgerEntry.count({ where }),
            prisma.sellerLedgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            prisma.sellerLedgerEntry.aggregate({ where: { ...where, waivedAt: null }, _sum: { amount: true } }),
        ]);
        const names = await storeNames(entries.map((e) => e.sellerId));
        return {
            totalCharged: round2(Math.abs(sum._sum.amount ?? 0)),
            entries: entries.map((e) => ({ ...e, storeName: names.get(e.sellerId) ?? null })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async addManual(adminId: string, input: { sellerId: string; amount: number; note: string; orderId?: string | undefined; type: 'PENALTY' | 'ADJUSTMENT' }) {
        const seller = await prisma.user.findFirst({ where: { id: input.sellerId, role: 'SELLER' } });
        if (!seller) throw ApiError.notFound('Seller not found');
        if (input.amount === 0) throw ApiError.badRequest('Amount cannot be zero');
        const amount = input.type === 'PENALTY' ? -Math.abs(input.amount) : input.amount;
        return prisma.sellerLedgerEntry.create({
            data: {
                sellerId: input.sellerId,
                type: input.type,
                amount: round2(amount),
                orderId: input.orderId ?? null,
                referenceId: `manual:${Date.now()}:${adminId}`,
                note: input.note,
                entryDate: utcDay(),
            },
        });
    }

    async waive(adminId: string, entryId: string) {
        const entry = await prisma.sellerLedgerEntry.findUnique({ where: { id: entryId } });
        if (!entry || entry.type !== 'PENALTY') throw ApiError.notFound('Penalty not found');
        if (entry.settledAt) throw ApiError.badRequest('This penalty was already deducted in a payout. Add a positive adjustment instead.');
        if (entry.waivedAt) throw ApiError.badRequest('Already waived');
        return prisma.sellerLedgerEntry.update({ where: { id: entryId }, data: { waivedAt: new Date(), waivedBy: adminId } });
    }

    /** Orders that have not been dispatched in time, across all sellers. */
    async slaBoard(query: Record<string, unknown>) {
        const now = new Date();
        const cutoff = addHours(now, -48); // created before this → past the 48h dispatch date
        const orders = await prisma.order.findMany({
            where: { status: 'CONFIRMED', createdAt: { lt: cutoff } },
            include: { items: { select: { sellerId: true, quantity: true, sellerPriceSnapshot: true } }, shipments: true },
            orderBy: { createdAt: 'asc' },
            take: Math.min(Number(query.limit) || 200, 500),
        });
        const cancelled = await prisma.sellerOrderCancellation.findMany({
            where: { orderId: { in: orders.map((o) => o.id) } },
            select: { orderId: true, sellerId: true },
        });
        const cancelledSet = new Set(cancelled.map((c) => `${c.orderId}:${c.sellerId}`));
        const rows: { orderId: string; sellerId: string; orderDate: Date; dispatchBy: Date; hoursOverdue: number; stage: string; amount: number }[] = [];
        for (const o of orders) {
            const sellers = [...new Set(o.items.map((i) => i.sellerId))];
            for (const sellerId of sellers) {
                if (cancelledSet.has(`${o.id}:${sellerId}`)) continue;
                const shipment = o.shipments.find((s) => s.seller_id === sellerId);
                if (shipment && shipment.status !== 'CREATED') continue;
                const due = dispatchBy(o.createdAt);
                rows.push({
                    orderId: o.id,
                    sellerId,
                    orderDate: o.createdAt,
                    dispatchBy: due,
                    hoursOverdue: Math.floor((now.getTime() - due.getTime()) / 3_600_000),
                    stage: shipment ? 'READY_TO_SHIP' : 'PENDING',
                    amount: round2(o.items.filter((i) => i.sellerId === sellerId).reduce((s, i) => s + i.sellerPriceSnapshot * i.quantity, 0)),
                });
            }
        }
        const names = await storeNames(rows.map((r) => r.sellerId));
        const rules = await getPenaltyRules();
        return {
            rules,
            rows: rows.map((r) => ({ ...r, storeName: names.get(r.sellerId) ?? null, willAutoCancel: rules.autoCancelAfterHours > 0 && r.hoursOverdue >= rules.autoCancelAfterHours })),
        };
    }

    /**
     * Auto-cancel sub-orders not dispatched `autoCancelAfterHours` after their
     * dispatch date (Meesho-style). Single-seller orders are fully cancelled and
     * refunded; the seller is charged the auto-cancel penalty.
     */
    async runAutoCancel(): Promise<{ cancelled: number }> {
        const rules = await getPenaltyRules();
        if (rules.autoCancelAfterHours <= 0) return { cancelled: 0 };
        const board = await this.slaBoard({ limit: 500 });
        let cancelled = 0;
        for (const row of board.rows.filter((r) => r.willAutoCancel)) {
            try {
                const order = await prisma.order.findUnique({ where: { id: row.orderId }, include: { items: { select: { sellerId: true } }, cancellationRequest: true } });
                if (!order || order.status === 'CANCELLED') continue;
                const reason = 'Auto-cancelled: not dispatched by the dispatch date';
                await prisma.sellerOrderCancellation.upsert({
                    where: { orderId_sellerId: { orderId: row.orderId, sellerId: row.sellerId } },
                    create: { orderId: row.orderId, sellerId: row.sellerId, reason },
                    update: {},
                });
                const request = order.cancellationRequest ?? (await prisma.cancellationRequest.create({ data: { orderId: order.id, userId: order.userId, reason } }));
                if (new Set(order.items.map((i) => i.sellerId)).size === 1) {
                    await cancellationService.approveCancellationBySeller(row.sellerId, request.id);
                }
                await chargePenalty(row.sellerId, row.orderId, rules.autoCancelPenalty, 'Auto-cancellation charge');
                cancelled += 1;
            } catch (err) {
                log.warn({ err, orderId: row.orderId }, 'Auto-cancel failed');
            }
        }
        if (cancelled) log.info({ cancelled }, 'Auto-cancelled overdue orders');
        return { cancelled };
    }
}

export async function storeNames(sellerIds: string[]) {
    const rows = await prisma.seller_profiles.findMany({
        where: { user_id: { in: [...new Set(sellerIds)] } },
        select: { user_id: true, store_name: true },
    });
    return new Map(rows.map((r) => [r.user_id, r.store_name]));
}

export const adminPenaltiesService = new AdminPenaltiesService();
