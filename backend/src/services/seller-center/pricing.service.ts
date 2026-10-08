/**
 * Pricing & Offers: earnings calculator, price recommendations, instant price
 * cuts, and seller-funded discount offers.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../errors/ApiError.js';
import { productService } from '../product.service.js';
import { productRepository } from '../../repositories/product.repository.js';
import { invalidateProductCaches, invalidateSellerPrivateCaches } from '../../utils/cache.util.js';
import { earningsFor, getCommissionTerms, parseLimit, parsePage, round2 } from './common.js';

const log = logger.child({ module: 'seller-pricing' });

class SellerPricingService {
    async calculator(sellerId: string, sellerPrice: number) {
        const terms = await getCommissionTerms(sellerId);
        return { ...earningsFor(sellerPrice, terms), commissionPct: terms.commissionPct };
    }

    /** Category price benchmarks: median customer price of live variants. */
    private async categoryMedians(categoryIds: string[]) {
        if (categoryIds.length === 0) return new Map<string, { median: number | null; count: number }>();
        const rows = await prisma.$queryRaw<{ category_id: string; median: number | null; count: bigint }[]>`
            SELECT p."category_id", percentile_cont(0.5) WITHIN GROUP (ORDER BY v."price") AS median, COUNT(*) AS count
            FROM "product_variants" v
            JOIN "products" p ON p."id" = v."product_id"
            WHERE v."status" = 'APPROVED' AND p."is_published" = true AND p."deleted_by_admin" = false
              AND p."category_id" IN (${Prisma.join(categoryIds)})
            GROUP BY p."category_id"
        `;
        return new Map(rows.map((r) => [r.category_id, { median: r.median == null ? null : round2(Number(r.median)), count: Number(r.count) }]));
    }

    async list(sellerId: string, query: Record<string, unknown>) {
        const page = parsePage(query.page);
        const limit = parseLimit(query.limit, 25);
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const where: Prisma.ProductVariantWhereInput = {
            product: { sellerId, deletedByAdmin: false, ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}) },
        };
        const [total, variants, terms, activeItems] = await Promise.all([
            prisma.productVariant.count({ where }),
            prisma.productVariant.findMany({
                where,
                include: { product: { select: { id: true, title: true, images: true, categoryId: true } }, inventory: true },
                orderBy: [{ product: { title: 'asc' } }, { createdAt: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            getCommissionTerms(sellerId),
            prisma.sellerOfferItem.findMany({
                where: { offer: { sellerId, status: { in: ['ACTIVE', 'SCHEDULED'] } } },
                include: { offer: { select: { id: true, name: true, discountPercent: true, status: true, endsAt: true } } },
            }),
        ]);
        const offerMap = new Map(activeItems.map((i) => [i.variantId, i.offer]));
        const medians = await this.categoryMedians([...new Set(variants.map((v) => v.product.categoryId))]);

        return {
            commission: terms,
            variants: variants.map((v) => {
                const bench = medians.get(v.product.categoryId);
                const benchmark = bench && bench.count >= 3 ? bench.median : null;
                const competitive = benchmark == null ? null : v.price <= benchmark * 1.1;
                // Recommend a seller price whose customer price lands at the benchmark.
                const margin = v.price - v.sellerPrice;
                const recommendedSellerPrice =
                    benchmark != null && !competitive ? round2(Math.max(1, benchmark - Math.max(0, margin))) : null;
                return {
                    variantId: v.id,
                    productId: v.product.id,
                    title: v.product.title,
                    image: v.images[0] ?? v.product.images[0] ?? null,
                    size: v.size,
                    color: v.color,
                    sku: v.sku,
                    status: v.status,
                    stock: v.inventory?.stock ?? 0,
                    sellerPrice: v.sellerPrice,
                    customerPrice: v.status === 'APPROVED' ? v.price : null,
                    mrp: v.compareAtPrice,
                    earnings: earningsFor(v.sellerPrice, terms),
                    benchmark,
                    competitive,
                    recommendedSellerPrice,
                    recommendedEarnings: recommendedSellerPrice ? earningsFor(recommendedSellerPrice, terms).net : null,
                    offer: offerMap.get(v.id) ?? null,
                };
            }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Change a variant's seller price. Cuts go live instantly (the platform keeps
     * its rupee margin); increases go back to admin review like any variant edit.
     */
    async updatePrice(sellerId: string, variantId: string, input: { sellerPrice?: number | undefined; mrp?: number | null | undefined}) {
        const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
        if (!variant || variant.product.sellerId !== sellerId) throw ApiError.notFound('Variant not found');
        if (variant.product.deletedByAdmin) throw ApiError.badRequest('This product was removed by admin');

        const inOffer = await prisma.sellerOfferItem.findFirst({ where: { variantId, offer: { status: 'ACTIVE' } } });
        if (inOffer && input.sellerPrice !== undefined) throw ApiError.badRequest('End the running offer before changing the price');

        let result: 'live' | 'review' | 'mrp' = 'mrp';
        if (input.sellerPrice !== undefined && input.sellerPrice !== variant.sellerPrice) {
            if (!(input.sellerPrice > 0)) throw ApiError.badRequest('Price must be greater than 0');
            if (input.sellerPrice < variant.sellerPrice && variant.status === 'APPROVED') {
                const margin = Math.max(0, variant.price - variant.sellerPrice);
                const newPrice = round2(input.sellerPrice + margin);
                await prisma.productVariant.update({
                    where: { id: variantId },
                    data: { sellerPrice: input.sellerPrice, price: newPrice, adminListingPrice: newPrice },
                });
                result = 'live';
            } else {
                await productService.updateVariant(variantId, sellerId, { sellerPrice: input.sellerPrice } as never);
                result = 'review';
            }
        }
        if (input.mrp !== undefined) {
            const current = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
            if (input.mrp !== null && input.mrp < current.price) throw ApiError.badRequest('MRP cannot be lower than the selling price');
            await prisma.productVariant.update({ where: { id: variantId }, data: { compareAtPrice: input.mrp } });
        }

        await productRepository.syncVariantSummary(variant.productId);
        await invalidateProductCaches(variant.productId);
        await invalidateSellerPrivateCaches(sellerId);
        return {
            result,
            message:
                result === 'live'
                    ? 'New price is live.'
                    : result === 'review'
                        ? 'Price increase sent for review. The variant is hidden until approved.'
                        : 'MRP updated.',
        };
    }

    // ── Offers ──────────────────────────────────────────────────────────────

    async listOffers(sellerId: string) {
        const offers = await prisma.sellerOffer.findMany({
            where: { sellerId },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        // Units and revenue sold on offer variants while the offer ran.
        const stats = await Promise.all(
            offers.map(async (o) => {
                const agg = await prisma.orderItem.aggregate({
                    where: {
                        sellerId,
                        variantId: { in: o.items.map((i) => i.variantId) },
                        order: { createdAt: { gte: o.startsAt, lte: o.endsAt }, status: { notIn: ['CANCELLED', 'PLACED'] } },
                    },
                    _sum: { quantity: true, sellerPriceSnapshot: true },
                    _count: { _all: true },
                });
                return { units: agg._sum.quantity ?? 0, orders: agg._count._all };
            })
        );
        return {
            offers: offers.map((o, idx) => ({
                id: o.id,
                name: o.name,
                discountPercent: o.discountPercent,
                startsAt: o.startsAt,
                endsAt: o.endsAt,
                status: o.status,
                variantCount: o.items.length,
                productCount: new Set(o.items.map((i) => i.productId)).size,
                unitsSold: stats[idx]?.units ?? 0,
                orders: stats[idx]?.orders ?? 0,
            })),
        };
    }

    async createOffer(sellerId: string, input: { name: string; discountPercent: number; startsAt: Date; endsAt: Date; productIds: string[] }) {
        if (input.discountPercent < 1 || input.discountPercent > 80) throw ApiError.badRequest('Discount must be between 1% and 80%');
        if (input.endsAt <= input.startsAt) throw ApiError.badRequest('End date must be after the start date');
        if (input.endsAt.getTime() - input.startsAt.getTime() > 60 * 86_400_000) throw ApiError.badRequest('Offers can run for at most 60 days');

        const variants = await prisma.productVariant.findMany({
            where: { product: { id: { in: input.productIds }, sellerId, deletedByAdmin: false }, status: 'APPROVED' },
            select: { id: true, productId: true, sellerPrice: true, price: true },
        });
        if (variants.length === 0) throw ApiError.badRequest('Pick at least one live product');

        const clash = await prisma.sellerOfferItem.findFirst({
            where: {
                variantId: { in: variants.map((v) => v.id) },
                offer: { status: { in: ['ACTIVE', 'SCHEDULED'] }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
            },
            include: { offer: { select: { name: true } } },
        });
        if (clash) throw ApiError.conflict(`Some products are already in the offer "${clash.offer.name}" for these dates`);

        const tooDeep = variants.filter((v) => round2((v.price * input.discountPercent) / 100) >= v.sellerPrice);
        if (tooDeep.length === variants.length) throw ApiError.badRequest('This discount is larger than your price on every selected product');

        const offer = await prisma.sellerOffer.create({
            data: {
                sellerId,
                name: input.name,
                discountPercent: input.discountPercent,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
                status: 'SCHEDULED',
                items: {
                    create: variants
                        .filter((v) => !tooDeep.includes(v))
                        .map((v) => ({ productId: v.productId, variantId: v.id })),
                },
            },
            include: { items: true },
        });
        await this.runOfferSchedule();
        await invalidateSellerPrivateCaches(sellerId);
        return { offer, skippedVariants: tooDeep.length };
    }

    async cancelOffer(sellerId: string, offerId: string) {
        const offer = await prisma.sellerOffer.findFirst({ where: { id: offerId, sellerId } });
        if (!offer) throw ApiError.notFound('Offer not found');
        if (offer.status === 'ENDED' || offer.status === 'CANCELLED') throw ApiError.badRequest('Offer has already ended');
        if (offer.status === 'ACTIVE') await this.revertOffer(offer.id);
        await prisma.sellerOffer.update({ where: { id: offer.id }, data: { status: 'CANCELLED' } });
        await invalidateSellerPrivateCaches(sellerId);
        return { ok: true };
    }

    /** Start due offers and end expired ones. Safe to run repeatedly. */
    async runOfferSchedule(): Promise<{ started: number; ended: number }> {
        const now = new Date();
        let started = 0;
        let ended = 0;
        const toEnd = await prisma.sellerOffer.findMany({ where: { status: 'ACTIVE', endsAt: { lte: now } } });
        for (const offer of toEnd) {
            await this.revertOffer(offer.id);
            await prisma.sellerOffer.update({ where: { id: offer.id }, data: { status: 'ENDED' } });
            ended += 1;
        }
        const toStart = await prisma.sellerOffer.findMany({ where: { status: 'SCHEDULED', startsAt: { lte: now } } });
        for (const offer of toStart) {
            if (offer.endsAt <= now) {
                await prisma.sellerOffer.update({ where: { id: offer.id }, data: { status: 'ENDED' } });
                continue;
            }
            await this.applyOffer(offer.id);
            started += 1;
        }
        if (started || ended) log.info({ started, ended }, 'Offer schedule applied');
        return { started, ended };
    }

    private async applyOffer(offerId: string) {
        const offer = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offerId }, include: { items: true } });
        const productIds = new Set<string>();
        for (const item of offer.items) {
            const v = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
            if (!v || v.status !== 'APPROVED') continue;
            const discount = round2((v.price * offer.discountPercent) / 100);
            if (discount >= v.sellerPrice) continue;
            const price = round2(v.price - discount);
            const sellerPrice = round2(v.sellerPrice - discount);
            await prisma.$transaction([
                prisma.sellerOfferItem.update({
                    where: { id: item.id },
                    data: {
                        originalPrice: v.price,
                        originalSellerPrice: v.sellerPrice,
                        originalCompareAt: v.compareAtPrice,
                        appliedPrice: price,
                        appliedSellerPrice: sellerPrice,
                    },
                }),
                prisma.productVariant.update({
                    where: { id: v.id },
                    data: { price, sellerPrice, compareAtPrice: Math.max(v.compareAtPrice ?? 0, v.price) },
                }),
            ]);
            productIds.add(v.productId);
        }
        await prisma.sellerOffer.update({ where: { id: offerId }, data: { status: 'ACTIVE' } });
        for (const id of productIds) await invalidateProductCaches(id);
        await invalidateSellerPrivateCaches(offer.sellerId);
    }

    private async revertOffer(offerId: string) {
        const offer = await prisma.sellerOffer.findUniqueOrThrow({ where: { id: offerId }, include: { items: true } });
        const productIds = new Set<string>();
        for (const item of offer.items) {
            if (item.originalPrice == null || item.originalSellerPrice == null) continue;
            const v = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
            // Only restore if nobody (e.g. an admin re-pricing) changed it meanwhile.
            if (!v || v.price !== item.appliedPrice) continue;
            await prisma.productVariant.update({
                where: { id: v.id },
                data: { price: item.originalPrice, sellerPrice: item.originalSellerPrice, compareAtPrice: item.originalCompareAt },
            });
            productIds.add(v.productId);
        }
        for (const id of productIds) await invalidateProductCaches(id);
        await invalidateSellerPrivateCaches(offer.sellerId);
    }
}

export const sellerPricingService = new SellerPricingService();
