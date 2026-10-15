/**
 * Admin control of a product's ratings & reviews: the rating, review count and
 * "people viewed" figures shown on the storefront (null = automatic), plus
 * adding and editing reviews under any reviewer name.
 */

import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../errors/ApiError.js';
import { invalidateCacheByPattern, invalidateProductCaches } from '../../utils/cache.util.js';

export const socialProofSchema = z.object({
    displayRating: z.number().min(1).max(5).nullable(),
    displayReviewCount: z.number().int().min(0).max(10_000_000).nullable(),
    displayViewCount: z.number().int().min(0).max(10_000_000).nullable(),
});

const reviewFields = {
    authorName: z.string().trim().min(1, 'Add the reviewer name').max(80),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(150).nullable().optional(),
    text: z.string().trim().min(1, 'Write the review').max(3000),
    images: z.array(z.string().url()).max(5).optional(),
    /** Shown as the review date; defaults to now. */
    createdAt: z.coerce.date().max(new Date(Date.now() + 60_000), 'Date cannot be in the future').optional(),
};
export const adminReviewCreateSchema = z.object({ productId: z.string().min(1), ...reviewFields });
export const adminReviewUpdateSchema = z.object(reviewFields).partial();

type ReviewRow = {
    id: string;
    rating: number;
    title: string | null;
    text: string;
    images: string[];
    authorName: string | null;
    helpfulCount: number;
    isHidden: boolean;
    createdAt: Date;
    user: { email: string | null; user_profiles: { full_name: string | null } | null };
};

function presentReview(r: ReviewRow) {
    return {
        id: r.id,
        rating: r.rating,
        title: r.title,
        text: r.text,
        images: r.images,
        helpfulCount: r.helpfulCount,
        isHidden: r.isHidden,
        createdAt: r.createdAt,
        authorName: r.authorName ?? r.user.user_profiles?.full_name ?? 'Anonymous',
        /** Added by an admin (no real customer account behind it). */
        addedByAdmin: r.authorName != null,
        customerEmail: r.authorName != null ? null : r.user.email,
    };
}

const reviewSelect = {
    id: true,
    rating: true,
    title: true,
    text: true,
    images: true,
    authorName: true,
    helpfulCount: true,
    isHidden: true,
    createdAt: true,
    user: { select: { email: true, user_profiles: { select: { full_name: true } } } },
} as const;

async function refresh(productId: string) {
    await Promise.allSettled([
        invalidateCacheByPattern(`reviews:${productId}:*`),
        invalidateProductCaches(productId),
        invalidateProductCaches(),
    ]);
}

class AdminReviewsService {
    async searchProducts(query: Record<string, unknown>) {
        const search = typeof query.search === 'string' ? query.search.trim() : '';
        const rows = await prisma.product.findMany({
            where: {
                deletedByAdmin: false,
                ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { id: search }] } : {}),
            },
            select: { id: true, title: true, images: true, status: true, displayRating: true, displayReviewCount: true, displayViewCount: true },
            orderBy: { updatedAt: 'desc' },
            take: 20,
        });
        return { products: rows.map((p) => ({ ...p, image: p.images[0] ?? null, images: undefined })) };
    }

    async productDetail(productId: string) {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, title: true, images: true, status: true, displayRating: true, displayReviewCount: true, displayViewCount: true },
        });
        if (!product) throw ApiError.notFound('Product not found');
        const [reviews, agg] = await Promise.all([
            prisma.review.findMany({ where: { productId }, select: reviewSelect, orderBy: { createdAt: 'desc' }, take: 200 }),
            prisma.review.aggregate({ where: { productId, isHidden: false }, _avg: { rating: true }, _count: { _all: true } }),
        ]);
        return {
            product: { ...product, image: product.images[0] ?? null, images: undefined },
            actual: { rating: agg._avg.rating == null ? null : Math.round(agg._avg.rating * 10) / 10, reviewCount: agg._count._all },
            reviews: reviews.map(presentReview),
        };
    }

    async setSocialProof(adminId: string, productId: string, input: z.infer<typeof socialProofSchema>) {
        const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!exists) throw ApiError.notFound('Product not found');
        await prisma.product.update({
            where: { id: productId },
            data: {
                displayRating: input.displayRating == null ? null : Math.round(input.displayRating * 10) / 10,
                displayReviewCount: input.displayReviewCount,
                displayViewCount: input.displayViewCount,
            },
        });
        await prisma.auditLog.create({
            data: { actorId: adminId, action: 'PRODUCT_SOCIAL_PROOF_SET', entityType: 'PRODUCT', entityId: productId, metadata: input },
        }).catch(() => undefined);
        await refresh(productId);
        return this.productDetail(productId);
    }

    async create(adminId: string, input: z.infer<typeof adminReviewCreateSchema>) {
        const exists = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } });
        if (!exists) throw ApiError.notFound('Product not found');
        // The admin's account owns the row; the public sees only authorName.
        const created = await prisma.review.create({
            data: {
                productId: input.productId,
                userId: adminId,
                authorName: input.authorName,
                rating: input.rating,
                title: input.title ?? null,
                text: input.text,
                images: input.images ?? [],
                ...(input.createdAt ? { createdAt: input.createdAt } : {}),
            },
            select: reviewSelect,
        });
        await refresh(input.productId);
        return presentReview(created);
    }

    async update(reviewId: string, input: z.infer<typeof adminReviewUpdateSchema>) {
        const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
        if (!review) throw ApiError.notFound('Review not found');
        const updated = await prisma.review.update({
            where: { id: reviewId },
            data: {
                ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
                ...(input.rating !== undefined ? { rating: input.rating } : {}),
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.text !== undefined ? { text: input.text } : {}),
                ...(input.images !== undefined ? { images: input.images } : {}),
                ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
            },
            select: reviewSelect,
        });
        await refresh(review.productId);
        return presentReview(updated);
    }

    async remove(reviewId: string) {
        const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
        if (!review) throw ApiError.notFound('Review not found');
        await prisma.review.delete({ where: { id: reviewId } });
        await refresh(review.productId);
        return { deleted: true };
    }

    async setHidden(reviewId: string, hidden: boolean) {
        const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
        if (!review) throw ApiError.notFound('Review not found');
        const updated = await prisma.review.update({ where: { id: reviewId }, data: { isHidden: hidden }, select: reviewSelect });
        await refresh(review.productId);
        return presentReview(updated);
    }
}

export const adminReviewsService = new AdminReviewsService();
