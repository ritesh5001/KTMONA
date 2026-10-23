/**
 * Cashback wallet.
 *
 * The ledger is `wallet_transactions`. Credits (cashback, referral rewards,
 * refunds of wallet money) carry a `remaining` balance; spending at checkout
 * and expiry consume credits oldest-expiry-first. Cashback is credited PENDING
 * when an order is delivered and released once the return window has passed
 * without a return — a returned or cancelled order never pays out.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../errors/ApiError.js';
import { notificationService } from '../notifications/notification.service.js';
import { offersConfigService } from './offers-config.service.js';

const log = logger.child({ module: 'wallet' });
const DAY_MS = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Spendable credits right now, oldest expiry first. */
function spendableWhere(userId: string): Prisma.WalletTransactionWhereInput {
    return {
        userId,
        kind: 'CREDIT',
        status: 'AVAILABLE',
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
}

export interface WalletSummary {
    available: number;
    pending: number;
    /** Earliest upcoming expiry among spendable credits. */
    nextExpiry: { amount: number; at: string } | null;
    rules: { cashbackPercent: number; maxUsePercent: number; holdDays: number; expiryDays: number; enabled: boolean };
}

export const walletService = {
    async summary(userId: string): Promise<WalletSummary> {
        const [config, credits, pending] = await Promise.all([
            offersConfigService.get(),
            prisma.walletTransaction.findMany({
                where: spendableWhere(userId),
                select: { remaining: true, expiresAt: true },
                orderBy: { expiresAt: 'asc' },
            }),
            prisma.walletTransaction.aggregate({
                where: { userId, kind: 'CREDIT', status: 'PENDING' },
                _sum: { amount: true },
            }),
        ]);
        const available = round2(credits.reduce((s, c) => s + c.remaining, 0));
        const first = credits.find((c) => c.expiresAt);
        return {
            available,
            pending: round2(pending._sum.amount ?? 0),
            nextExpiry: first?.expiresAt
                ? {
                    amount: round2(credits.filter((c) => c.expiresAt?.getTime() === first.expiresAt!.getTime()).reduce((s, c) => s + c.remaining, 0)),
                    at: first.expiresAt.toISOString(),
                }
                : null,
            rules: {
                enabled: config.cashback.enabled,
                cashbackPercent: config.cashback.percent,
                maxUsePercent: config.cashback.maxUsePercent,
                holdDays: config.cashback.holdDays,
                expiryDays: config.cashback.expiryDays,
            },
        };
    },

    async transactions(userId: string, page = 1, limit = 30) {
        const take = Math.min(100, Math.max(1, limit));
        const rows = await prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (Math.max(1, page) - 1) * take,
            take,
        });
        return {
            transactions: rows.map((r) => ({
                id: r.id,
                kind: r.kind,
                source: r.source,
                status: r.status,
                amount: r.amount,
                remaining: r.remaining,
                orderId: r.orderId,
                note: r.note,
                availableAt: r.availableAt?.toISOString() ?? null,
                expiresAt: r.expiresAt?.toISOString() ?? null,
                createdAt: r.createdAt.toISOString(),
            })),
        };
    },

    /** How much wallet money may go towards an order of this payable total. */
    async usableFor(userId: string, orderTotal: number): Promise<{ available: number; usable: number }> {
        const [config, credits] = await Promise.all([
            offersConfigService.get(),
            prisma.walletTransaction.aggregate({ where: spendableWhere(userId), _sum: { remaining: true } }),
        ]);
        const available = round2(credits._sum.remaining ?? 0);
        const cap = Math.floor((orderTotal * config.cashback.maxUsePercent) / 100);
        return { available, usable: Math.max(0, Math.min(available, cap)) };
    },

    /**
     * Spend `amount` from the wallet inside the checkout transaction. Locks the
     * buyer's credits so two checkouts cannot spend the same rupee.
     */
    async debitInTx(tx: Tx, userId: string, amount: number, orderId: string): Promise<void> {
        if (amount <= 0) return;
        await tx.$queryRaw`SELECT id FROM "wallet_transactions" WHERE "user_id" = ${userId} AND "status" = 'AVAILABLE' AND "remaining" > 0 FOR UPDATE`;
        const credits = await tx.walletTransaction.findMany({
            where: spendableWhere(userId),
            orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
        });
        let left = round2(amount);
        for (const c of credits) {
            if (left <= 0) break;
            const take = round2(Math.min(c.remaining, left));
            await tx.walletTransaction.update({ where: { id: c.id }, data: { remaining: round2(c.remaining - take) } });
            left = round2(left - take);
        }
        if (left > 0.009) {
            throw ApiError.conflict('Your cashback balance changed. Please review your order and try again.');
        }
        await tx.walletTransaction.create({
            data: { userId, kind: 'DEBIT', source: 'CHECKOUT', status: 'DONE', amount: round2(amount), orderId, note: 'Used on order' },
        });
    },

    /**
     * Order cancelled: give back any wallet money it used, and cancel cashback /
     * referral rewards still pending on it.
     */
    async onOrderCancelled(orderId: string): Promise<void> {
        const config = await offersConfigService.get();
        const [debit, refunded] = await Promise.all([
            prisma.walletTransaction.findFirst({ where: { orderId, kind: 'DEBIT', source: 'CHECKOUT' } }),
            prisma.walletTransaction.findFirst({ where: { orderId, kind: 'CREDIT', source: 'ORDER_REFUND' } }),
        ]);
        if (debit && !refunded) {
            await prisma.walletTransaction.create({
                data: {
                    userId: debit.userId,
                    kind: 'CREDIT',
                    source: 'ORDER_REFUND',
                    status: 'AVAILABLE',
                    amount: debit.amount,
                    remaining: debit.amount,
                    orderId,
                    note: 'Cashback returned from a cancelled order',
                    availableAt: new Date(),
                    expiresAt: new Date(Date.now() + config.cashback.expiryDays * DAY_MS),
                },
            });
        }
        await prisma.walletTransaction.updateMany({
            where: { orderId, kind: 'CREDIT', status: 'PENDING' },
            data: { status: 'REVERSED', note: 'Order cancelled' },
        });
        await prisma.referral.updateMany({
            where: { firstOrderId: orderId, status: { in: ['SIGNED_UP', 'ORDERED'] } },
            data: { status: 'CANCELLED' },
        });
    },

    /**
     * Order delivered: credit its cashback (and the referrer's reward, if this was
     * a referred customer's first order) as PENDING until the return window ends.
     */
    async onOrderDelivered(orderId: string): Promise<void> {
        const config = await offersConfigService.get();
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, userId: true, subTotalAmount: true, walletAmount: true, status: true },
        });
        if (!order || order.status !== 'DELIVERED') return;
        const availableAt = new Date(Date.now() + config.cashback.holdDays * DAY_MS);
        const expiresAt = new Date(availableAt.getTime() + config.cashback.expiryDays * DAY_MS);

        if (config.cashback.enabled && config.cashback.percent > 0) {
            const exists = await prisma.walletTransaction.findFirst({ where: { orderId, source: 'CASHBACK' } });
            // Cashback on what was actually paid for items (after coupons and wallet use).
            const base = Math.max(0, order.subTotalAmount - order.walletAmount);
            let amount = Math.floor((base * config.cashback.percent) / 100);
            if (config.cashback.maxPerOrder > 0) amount = Math.min(amount, config.cashback.maxPerOrder);
            if (!exists && amount > 0) {
                await prisma.walletTransaction.create({
                    data: {
                        userId: order.userId,
                        kind: 'CREDIT',
                        source: 'CASHBACK',
                        status: 'PENDING',
                        amount,
                        orderId,
                        note: `${config.cashback.percent}% cashback`,
                        availableAt,
                        expiresAt,
                    },
                });
                void notificationService.create({
                    userId: order.userId,
                    role: 'USER',
                    type: 'ORDER_UPDATE',
                    channel: 'EMAIL',
                    content: `₹${amount} cashback on its way`,
                    metadata: {
                        orderId,
                        title: `₹${amount} cashback on its way`,
                        message: `You earned ₹${amount} cashback on order #${orderId.slice(0, 8).toUpperCase()}. It becomes usable on ${availableAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, once the return window closes.`,
                    },
                    eventKey: `CASHBACK_PENDING:${orderId}`,
                }).catch(() => undefined);
            }
        }

        // Referral: reward the referrer when the friend's first order is delivered.
        const referral = await prisma.referral.findFirst({
            where: { referredUserId: order.userId, firstOrderId: orderId, status: 'ORDERED' },
        });
        if (referral && config.referral.enabled && config.referral.referrerAmount > 0) {
            const already = await prisma.walletTransaction.findFirst({ where: { orderId, source: 'REFERRAL' } });
            const earned = await prisma.referral.count({ where: { referrerId: referral.referrerId, status: 'REWARDED' } });
            if (!already && earned < config.referral.maxRewards) {
                await prisma.walletTransaction.create({
                    data: {
                        userId: referral.referrerId,
                        kind: 'CREDIT',
                        source: 'REFERRAL',
                        status: 'PENDING',
                        amount: config.referral.referrerAmount,
                        orderId,
                        note: 'Referral reward',
                        availableAt,
                        expiresAt,
                    },
                });
            }
        }
    },

    /**
     * Maintenance sweep: release pending credits whose return window has closed
     * (or reverse them if the order came back), and expire old credits.
     */
    async sweep(): Promise<{ released: number; reversed: number; expired: number }> {
        const now = new Date();
        let released = 0;
        let reversed = 0;
        let expired = 0;

        const due = await prisma.walletTransaction.findMany({
            where: { kind: 'CREDIT', status: 'PENDING', availableAt: { lte: now } },
            take: 500,
        });
        for (const c of due) {
            const order = c.orderId
                ? await prisma.order.findUnique({
                    where: { id: c.orderId },
                    select: { status: true, returnRequests: { select: { status: true } } },
                })
                : null;
            const openReturn = order?.returnRequests.some((r) => ['REQUESTED', 'APPROVED', 'INSPECTING'].includes(r.status));
            if (openReturn) continue; // decide once the return is settled
            const returned = order?.returnRequests.some((r) => r.status === 'REFUNDED') ?? false;
            if (!order || order.status === 'CANCELLED' || returned) {
                await prisma.walletTransaction.update({ where: { id: c.id }, data: { status: 'REVERSED', note: `${c.note ?? ''} (order returned)`.trim() } });
                if (c.source === 'REFERRAL' && c.orderId) {
                    await prisma.referral.updateMany({ where: { firstOrderId: c.orderId }, data: { status: 'CANCELLED' } });
                }
                reversed += 1;
                continue;
            }
            await prisma.walletTransaction.update({ where: { id: c.id }, data: { status: 'AVAILABLE', remaining: c.amount } });
            if (c.source === 'REFERRAL' && c.orderId) {
                await prisma.referral.updateMany({ where: { firstOrderId: c.orderId }, data: { status: 'REWARDED', rewardedAt: now } });
            }
            released += 1;
            void notificationService.create({
                userId: c.userId,
                role: 'USER',
                type: 'ORDER_UPDATE',
                channel: 'EMAIL',
                content: `₹${c.amount} added to your KTMONA wallet`,
                metadata: {
                    title: `₹${c.amount} added to your wallet`,
                    message: `${c.source === 'REFERRAL' ? 'Your referral reward' : 'Your cashback'} of ₹${c.amount} is ready to use${c.expiresAt ? ` until ${c.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`,
                },
                eventKey: `WALLET_RELEASED:${c.id}`,
            }).catch(() => undefined);
        }

        const stale = await prisma.walletTransaction.findMany({
            where: { kind: 'CREDIT', status: 'AVAILABLE', remaining: { gt: 0 }, expiresAt: { lte: now } },
            take: 500,
        });
        for (const c of stale) {
            await prisma.$transaction([
                prisma.walletTransaction.update({ where: { id: c.id }, data: { remaining: 0 } }),
                prisma.walletTransaction.create({
                    data: { userId: c.userId, kind: 'DEBIT', source: 'EXPIRY', status: 'DONE', amount: c.remaining, note: 'Cashback expired' },
                }),
            ]);
            expired += 1;
        }

        if (released || reversed || expired) log.info({ released, reversed, expired }, 'wallet sweep');
        return { released, reversed, expired };
    },
};
