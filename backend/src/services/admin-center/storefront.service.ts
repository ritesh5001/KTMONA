import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { dispatchFreshness } from '../../live/freshness.service.js';
import { CACHE_TAGS } from '../../live/cache-tags.js';

/**
 * Homepage banners the admin manages. Stored as one JSON row in app_settings;
 * when no banners are saved the storefront falls back to its built-in designs.
 */
const KEY = 'storefront.home_banners';

export const bannerSchema = z.object({
    imageUrl: z.string().url().max(1000),
    mobileImageUrl: z.string().url().max(1000).nullable().optional(),
    href: z.string().max(500).nullable().optional(),
    alt: z.string().max(160).default(''),
});

export const homeBannersSchema = z.object({
    hero: z.array(bannerSchema).max(8).default([]),
    promo: bannerSchema.nullable().default(null),
});

export type HomeBanners = z.infer<typeof homeBannersSchema>;

const EMPTY: HomeBanners = { hero: [], promo: null };

export const storefrontService = {
    async getBanners(): Promise<HomeBanners> {
        const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
        if (!row) return EMPTY;
        try {
            return homeBannersSchema.parse(JSON.parse(row.value));
        } catch {
            return EMPTY;
        }
    },

    async saveBanners(input: unknown): Promise<HomeBanners> {
        const banners = homeBannersSchema.parse(input);
        const value = JSON.stringify(banners);
        await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
        await dispatchFreshness({
            type: 'catalog.updated',
            tags: [CACHE_TAGS.storefront],
            audience: { allAuthenticated: true },
        }).catch(() => undefined);
        return banners;
    },
};
