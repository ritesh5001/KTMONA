/**
 * Admin-editable rules for cashback, referrals and the welcome offer, kept as one
 * JSON row in `app_settings` (key `offers_config`). Defaults are the launch rules
 * the client chose: 5% cashback usable on up to 20% of an order, ₹100 + ₹100
 * referrals, ₹100 off a first order of ₹499+.
 */

import { z } from 'zod';
import { prisma } from '../config/db.js';

const KEY = 'offers_config';
const CACHE_MS = 60_000;

export const offersConfigSchema = z.object({
    cashback: z.object({
        enabled: z.boolean(),
        /** % of the order's item value credited as cashback. */
        percent: z.number().min(0).max(50),
        /** Cap per order (₹), 0 = no cap. */
        maxPerOrder: z.number().min(0),
        /** Days after delivery before cashback can be used (the return window). */
        holdDays: z.number().int().min(0).max(60),
        /** Days a credit stays usable once released. */
        expiryDays: z.number().int().min(1).max(730),
        /** Most of an order (%) that wallet balance may pay for. */
        maxUsePercent: z.number().min(0).max(100),
    }),
    referral: z.object({
        enabled: z.boolean(),
        /** Extra ₹ off the referred friend's first order. */
        friendAmount: z.number().min(0),
        /** Cashback ₹ to the referrer once that order is past the return window. */
        referrerAmount: z.number().min(0),
        /** Friend's first order must be at least this (₹). */
        minOrder: z.number().min(0),
        /** Rewards one person can earn in total. */
        maxRewards: z.number().int().min(0),
    }),
    welcome: z.object({
        enabled: z.boolean(),
        /** ₹ off a customer's first order. */
        amount: z.number().min(0),
        minOrder: z.number().min(0),
    }),
});

export type OffersConfig = z.infer<typeof offersConfigSchema>;

export const DEFAULT_OFFERS_CONFIG: OffersConfig = {
    cashback: { enabled: true, percent: 5, maxPerOrder: 0, holdDays: 7, expiryDays: 90, maxUsePercent: 20 },
    referral: { enabled: true, friendAmount: 100, referrerAmount: 100, minOrder: 499, maxRewards: 50 },
    welcome: { enabled: true, amount: 100, minOrder: 499 },
};

let cache: { value: OffersConfig; at: number } | null = null;

function merge(raw: unknown): OffersConfig {
    const r = (raw ?? {}) as Partial<OffersConfig>;
    const merged = {
        cashback: { ...DEFAULT_OFFERS_CONFIG.cashback, ...(r.cashback ?? {}) },
        referral: { ...DEFAULT_OFFERS_CONFIG.referral, ...(r.referral ?? {}) },
        welcome: { ...DEFAULT_OFFERS_CONFIG.welcome, ...(r.welcome ?? {}) },
    };
    const parsed = offersConfigSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_OFFERS_CONFIG;
}

export const offersConfigService = {
    async get(): Promise<OffersConfig> {
        if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
        const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
        let value = DEFAULT_OFFERS_CONFIG;
        if (row) {
            try {
                value = merge(JSON.parse(row.value));
            } catch {
                value = DEFAULT_OFFERS_CONFIG;
            }
        }
        cache = { value, at: Date.now() };
        return value;
    },

    async update(patch: unknown): Promise<OffersConfig> {
        const current = await this.get();
        const p = (patch ?? {}) as Partial<Record<keyof OffersConfig, object>>;
        const next = offersConfigSchema.parse({
            cashback: { ...current.cashback, ...(p.cashback ?? {}) },
            referral: { ...current.referral, ...(p.referral ?? {}) },
            welcome: { ...current.welcome, ...(p.welcome ?? {}) },
        });
        await prisma.appSetting.upsert({
            where: { key: KEY },
            create: { key: KEY, value: JSON.stringify(next) },
            update: { value: JSON.stringify(next) },
        });
        cache = { value: next, at: Date.now() };
        return next;
    },
};
