/**
 * Public shop pages (Meesho-style "View Shop"): who the seller is, their
 * rating from shopper reviews, and how many live products they have. The
 * products themselves come from GET /v1/products?sellerId=… so they share the
 * storefront's sorting, filters and caching.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';

export const storeService = {
    /** Active shops with at least one live product, biggest catalogues first. */
    async list(query: Record<string, unknown>) {
        const search = typeof query.search === 'string' ? query.search.trim().slice(0, 80) : '';
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(48, Math.max(1, Number(query.limit) || 24));
        const rows = await prisma.$queryRaw<
            { user_id: string; store_name: string; store_slug: string; store_logo: string | null; city: string | null; products: number }[]
        >`
            SELECT sp."user_id", sp."store_name", sp."store_slug", sp."store_logo", sp."pickup_city" AS city,
                   COUNT(p."id")::int AS products
            FROM "seller_profiles" sp
            JOIN "users" u ON u."id" = sp."user_id" AND u."status" = 'ACTIVE'
            JOIN "products" p ON p."seller_id" = sp."user_id" AND p."status" = 'APPROVED'
                 AND p."deleted_by_admin" = false AND p."paused_by_seller" = false AND p."paused_for_vacation" = false
            WHERE ${search ? Prisma.sql`sp."store_name" ILIKE ${'%' + search + '%'}` : Prisma.sql`TRUE`}
            GROUP BY sp."user_id"
            ORDER BY products DESC, sp."store_name" ASC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
        return {
            stores: rows.map((r) => ({ slug: r.store_slug, name: r.store_name, logo: r.store_logo, city: r.city, productCount: r.products })),
            page,
            hasMore: rows.length === limit,
        };
    },

    async getBySlug(slug: string) {
        const profile = await prisma.seller_profiles.findUnique({
            where: { store_slug: slug },
            select: {
                user_id: true,
                store_name: true,
                store_slug: true,
                store_description: true,
                store_logo: true,
                pickup_city: true,
                pickup_state: true,
                state: true,
                vacation_mode: true,
                created_at: true,
                users: { select: { status: true } },
            },
        });
        // Suspended or not-yet-approved sellers have no public shop.
        if (!profile || profile.users.status !== 'ACTIVE') throw ApiError.notFound('Shop not found');

        const liveProduct = {
            sellerId: profile.user_id,
            status: 'APPROVED' as const,
            deletedByAdmin: false,
            pausedBySeller: false,
            pausedForVacation: false,
        };
        const [productCount, rating] = await Promise.all([
            prisma.product.count({ where: liveProduct }),
            prisma.review.aggregate({
                where: { isHidden: false, product: liveProduct },
                _avg: { rating: true },
                _count: { _all: true },
            }),
        ]);

        return {
            store: {
                sellerId: profile.user_id,
                slug: profile.store_slug,
                name: profile.store_name,
                description: profile.store_description,
                logo: profile.store_logo,
                city: profile.pickup_city,
                state: profile.pickup_state || profile.state || null,
                onHoliday: profile.vacation_mode,
                memberSince: profile.created_at,
                productCount,
                rating: {
                    average: rating._avg.rating == null ? null : Math.round(rating._avg.rating * 10) / 10,
                    count: rating._count._all,
                },
            },
        };
    },
};
