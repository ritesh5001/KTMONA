/**
 * KTMONA Price Lock.
 *
 * A seller nominates live products they sell at the lowest price in the
 * market. An admin reviews each request; approval snapshots the current lowest
 * selling price into `priceLockPrice`. Shoppers see the badge (and the product
 * appears under Price Lock on the storefront) only while the product's price
 * stays at or below that snapshot — raising the price quietly drops the badge
 * without anyone having to remember to revoke it.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { invalidateProductCaches } from '../utils/cache.util.js';
import { parseLimit, parsePage, round2 } from './seller-center/common.js';
import { storeNames } from './admin-center/penalties.service.js';

export const priceLockIdsSchema = z.object({
    productIds: z.array(z.string().min(1)).min(1, 'Pick at least one product').max(100),
});

export const priceLockReviewSchema = priceLockIdsSchema.extend({
    action: z.enum(['APPROVE', 'REJECT', 'REVOKE']),
    note: z.string().trim().max(300).optional(),
});

const SELLER_TABS = ['eligible', 'pending', 'approved', 'rejected'] as const;
type SellerTab = (typeof SELLER_TABS)[number];

const productSelect = {
    id: true,
    title: true,
    images: true,
    sellerId: true,
    status: true,
    isPublished: true,
    priceLockStatus: true,
    priceLockPrice: true,
    priceLockRequestedAt: true,
    priceLockReviewedAt: true,
    priceLockNote: true,
    category: { select: { id: true, name: true } },
    variants: { select: { price: true, compareAtPrice: true, status: true, images: true } },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** Lists and every touched product page must show the badge change at once. */
async function refreshProductCaches(productIds: string[]): Promise<void> {
    await invalidateProductCaches();
    await Promise.allSettled(productIds.map((id) => invalidateProductCaches(id)));
}

/** Lowest price a shopper pays for the product today (approved variants). */
function lowestPrice(row: Row): number | null {
    const prices = row.variants.filter((v) => v.status === 'APPROVED').map((v) => v.price);
    return prices.length ? Math.min(...prices) : null;
}

function present(row: Row) {
    const current = lowestPrice(row);
    const locked = row.priceLockPrice;
    const isLive = row.status === 'APPROVED' && row.isPublished;
    return {
        id: row.id,
        title: row.title,
        image: row.images[0] ?? row.variants.find((v) => v.images.length)?.images[0] ?? null,
        category: row.category,
        isLive,
        currentPrice: current == null ? null : round2(current),
        mrp: row.variants.reduce<number | null>((max, v) => (v.compareAtPrice != null && (max == null || v.compareAtPrice > max) ? v.compareAtPrice : max), null),
        status: row.priceLockStatus,
        lockedPrice: locked == null ? null : round2(locked),
        /** Approved but the price has since gone up: badge is hidden. */
        priceRaised: row.priceLockStatus === 'APPROVED' && locked != null && current != null && current > locked + 0.001,
        requestedAt: row.priceLockRequestedAt,
        reviewedAt: row.priceLockReviewedAt,
        note: row.priceLockNote,
    };
}

class PriceLockService {
    // ── Seller ───────────────────────────────────────────────────────────────
    async sellerList(sellerId: string, query: Record<string, unknown>) {
        const tab: SellerTab = SELLER_TABS.includes(query.tab as SellerTab) ? (query.tab as SellerTab) : 'eligible';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 50);
        const search = typeof query.search === 'string' ? query.search.trim() : '';

        const base: Prisma.ProductWhereInput = {
            sellerId,
            deletedByAdmin: false,
            ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };
        const byTab: Record<SellerTab, Prisma.ProductWhereInput> = {
            eligible: { status: 'APPROVED', priceLockStatus: null },
            pending: { priceLockStatus: 'PENDING' },
            approved: { priceLockStatus: 'APPROVED' },
            rejected: { priceLockStatus: 'REJECTED' },
        };
        const where = { ...base, ...byTab[tab] };

        const [total, rows, counts] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({ where, select: productSelect, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            Promise.all(SELLER_TABS.map((t) => prisma.product.count({ where: { ...base, ...byTab[t] } }))),
        ]);

        return {
            tab,
            counts: Object.fromEntries(SELLER_TABS.map((t, i) => [t, counts[i]])),
            products: rows.map(present),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async sellerRequest(sellerId: string, input: z.infer<typeof priceLockIdsSchema>) {
        const rows = await prisma.product.findMany({
            where: { id: { in: input.productIds }, sellerId, deletedByAdmin: false },
            select: productSelect,
        });
        const results: { productId: string; ok: boolean; error?: string }[] = [];
        for (const id of input.productIds) {
            const row = rows.find((r) => r.id === id);
            if (!row) {
                results.push({ productId: id, ok: false, error: 'Product not found' });
            } else if (row.status !== 'APPROVED') {
                results.push({ productId: id, ok: false, error: 'Only live (QC-approved) products can join Price Lock' });
            } else if (row.priceLockStatus === 'PENDING' || row.priceLockStatus === 'APPROVED') {
                results.push({ productId: id, ok: false, error: 'Already submitted' });
            } else if (lowestPrice(row) == null) {
                results.push({ productId: id, ok: false, error: 'Product has no approved price yet' });
            } else {
                await prisma.product.update({
                    where: { id },
                    data: {
                        priceLockStatus: 'PENDING',
                        priceLockPrice: lowestPrice(row),
                        priceLockRequestedAt: new Date(),
                        priceLockReviewedAt: null,
                        priceLockReviewedBy: null,
                        priceLockNote: null,
                    },
                });
                results.push({ productId: id, ok: true });
            }
        }
        return { results, done: results.filter((r) => r.ok).length };
    }

    async sellerWithdraw(sellerId: string, input: z.infer<typeof priceLockIdsSchema>) {
        const { count } = await prisma.product.updateMany({
            where: { id: { in: input.productIds }, sellerId, priceLockStatus: { not: null } },
            data: {
                priceLockStatus: null,
                priceLockPrice: null,
                priceLockRequestedAt: null,
                priceLockReviewedAt: null,
                priceLockReviewedBy: null,
                priceLockNote: null,
            },
        });
        if (count > 0) await refreshProductCaches(input.productIds);
        return { done: count };
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    async adminQueue(query: Record<string, unknown>) {
        const statuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
        const status = statuses.includes(query.status as (typeof statuses)[number]) ? (query.status as (typeof statuses)[number]) : 'PENDING';
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 20, 50);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const where: Prisma.ProductWhereInput = {
            deletedByAdmin: false,
            priceLockStatus: status,
            ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        };

        const [total, rows, counts] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({ where, select: productSelect, orderBy: { priceLockRequestedAt: 'asc' }, skip: (page - 1) * limit, take: limit }),
            Promise.all(statuses.map((s) => prisma.product.count({ where: { deletedByAdmin: false, priceLockStatus: s } }))),
        ]);

        // Reference point for the reviewer: the lowest live price among OTHER
        // sellers' products in the same category.
        const categoryIds = [...new Set(rows.map((r) => r.category.id))];
        const lowestByCategory = categoryIds.length
            ? await prisma.$queryRaw<{ category_id: string; seller_id: string; price: number }[]>`
                SELECT p."category_id", p."seller_id", MIN(v."price") AS price
                FROM "product_variants" v JOIN "products" p ON p."id" = v."product_id"
                WHERE v."status" = 'APPROVED' AND p."status" = 'APPROVED' AND p."is_published" = true
                  AND p."deleted_by_admin" = false AND p."category_id" IN (${Prisma.join(categoryIds)})
                GROUP BY p."category_id", p."seller_id"`
            : [];
        const names = await storeNames(rows.map((r) => r.sellerId));

        return {
            status,
            counts: Object.fromEntries(statuses.map((s, i) => [s, counts[i]])),
            products: rows.map((row) => {
                const others = lowestByCategory.filter((l) => l.category_id === row.category.id && l.seller_id !== row.sellerId);
                const competitor = others.length ? Math.min(...others.map((o) => Number(o.price))) : null;
                return {
                    ...present(row),
                    seller: { id: row.sellerId, storeName: names.get(row.sellerId) ?? null },
                    lowestOtherSellerPrice: competitor == null ? null : round2(competitor),
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async adminReview(adminId: string, input: z.infer<typeof priceLockReviewSchema>) {
        if (input.action !== 'APPROVE' && !input.note?.trim()) {
            throw ApiError.badRequest('Add a note so the seller knows why');
        }
        const rows = await prisma.product.findMany({
            where: { id: { in: input.productIds }, deletedByAdmin: false, priceLockStatus: { not: null } },
            select: productSelect,
        });
        let done = 0;
        for (const row of rows) {
            if (input.action === 'APPROVE') {
                const current = lowestPrice(row);
                if (current == null) continue;
                await prisma.product.update({
                    where: { id: row.id },
                    data: {
                        priceLockStatus: 'APPROVED',
                        // Lock today's price: the badge stays only while the
                        // seller does not raise it.
                        priceLockPrice: current,
                        priceLockReviewedAt: new Date(),
                        priceLockReviewedBy: adminId,
                        priceLockNote: input.note?.trim() || null,
                    },
                });
            } else {
                await prisma.product.update({
                    where: { id: row.id },
                    data: {
                        priceLockStatus: 'REJECTED',
                        priceLockReviewedAt: new Date(),
                        priceLockReviewedBy: adminId,
                        priceLockNote: input.note!.trim(),
                    },
                });
            }
            done += 1;
        }
        await refreshProductCaches(rows.map((r) => r.id));
        return { done };
    }
}

export const priceLockService = new PriceLockService();
