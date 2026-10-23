/**
 * Referral program: every customer gets a code / link to share. A friend who
 * signs up with it gets the referral bonus on their first order; the referrer
 * earns cashback once that order is delivered and past the return window
 * (credited by walletService).
 */

import { randomInt } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { offersConfigService } from './offers-config.service.js';

const log = logger.child({ module: 'referral' });
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
    let s = 'KT';
    for (let i = 0; i < 6; i += 1) s += ALPHABET[randomInt(ALPHABET.length)];
    return s;
}

export function normalizeReferralCode(code: string | null | undefined): string | null {
    const c = (code ?? '').trim().toUpperCase();
    return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
}

export const referralService = {
    async getOrCreateCode(userId: string): Promise<string> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
        if (user?.referralCode) return user.referralCode;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
                const updated = await prisma.user.update({
                    where: { id: userId },
                    data: { referralCode: newCode() },
                    select: { referralCode: true },
                });
                return updated.referralCode!;
            } catch {
                // Code collision: try another.
            }
        }
        throw new Error('Could not create a referral code');
    },

    /** Link a just-created account to the referrer whose code it signed up with. */
    async attachAtSignup(newUserId: string, code: string | null | undefined): Promise<void> {
        const normalized = normalizeReferralCode(code);
        if (!normalized) return;
        const config = await offersConfigService.get();
        if (!config.referral.enabled) return;
        const referrer = await prisma.user.findUnique({
            where: { referralCode: normalized },
            select: { id: true, role: true },
        });
        if (!referrer || referrer.id === newUserId || referrer.role !== 'USER') return;
        try {
            await prisma.$transaction([
                prisma.referral.create({ data: { referrerId: referrer.id, referredUserId: newUserId } }),
                prisma.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } }),
            ]);
        } catch (err) {
            log.warn({ err: err instanceof Error ? err.message : String(err), newUserId }, 'referral_attach_failed');
        }
    },

    /** The referral row if this customer was referred and has not ordered yet. */
    async pendingFor(userId: string) {
        return prisma.referral.findFirst({ where: { referredUserId: userId, status: 'SIGNED_UP' } });
    },

    async markFirstOrder(userId: string, orderId: string): Promise<void> {
        await prisma.referral.updateMany({
            where: { referredUserId: userId, status: 'SIGNED_UP' },
            data: { status: 'ORDERED', firstOrderId: orderId },
        });
    },

    async overview(userId: string) {
        const [code, config, referrals] = await Promise.all([
            this.getOrCreateCode(userId),
            offersConfigService.get(),
            prisma.referral.findMany({ where: { referrerId: userId }, orderBy: { createdAt: 'desc' }, take: 200 }),
        ]);
        const friends = referrals.length
            ? await prisma.user.findMany({
                where: { id: { in: referrals.map((r) => r.referredUserId) } },
                select: { id: true, user_profiles: { select: { full_name: true } } },
            })
            : [];
        const nameOf = new Map(friends.map((f) => [f.id, f.user_profiles?.full_name ?? null]));
        const base = (env.FRONTEND_BASE_URL ?? 'https://www.ktmona.com').replace(/\/+$/, '');
        const rewarded = referrals.filter((r) => r.status === 'REWARDED').length;
        return {
            code,
            link: `${base}/register/user?ref=${code}`,
            enabled: config.referral.enabled,
            rules: {
                friendAmount: config.referral.friendAmount,
                referrerAmount: config.referral.referrerAmount,
                minOrder: config.referral.minOrder,
                maxRewards: config.referral.maxRewards,
                holdDays: config.cashback.holdDays,
            },
            stats: {
                joined: referrals.length,
                rewarded,
                earned: rewarded * config.referral.referrerAmount,
                remaining: Math.max(0, config.referral.maxRewards - rewarded),
            },
            referrals: referrals.map((r) => ({
                id: r.id,
                // First name only: the friend's privacy.
                name: (nameOf.get(r.referredUserId) ?? 'A friend').split(' ')[0],
                status: r.status,
                joinedAt: r.createdAt.toISOString(),
                rewardedAt: r.rewardedAt?.toISOString() ?? null,
            })),
        };
    },
};
