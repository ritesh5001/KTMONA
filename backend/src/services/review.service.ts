import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { reviewRepository } from '../repositories/review.repository.js';
import { notificationService } from '../notifications/notification.service.js';
import {
    CACHE_KEYS,
    getFromCache,
    setCache,
    invalidateCacheByPattern,
} from '../utils/cache.util.js';

interface CreateReviewInput {
    rating: number;
    title?: string | null;
    text: string;
    images?: string[];
    sellerRating?: number | null;
}

/** Reports that hide a review until an admin looks at it. */
const REPORTS_TO_HIDE = 3;
/** Reviews one customer may post per day (spam guard). */
const REVIEWS_PER_DAY = 5;

const normalizeText = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim();

interface ReviewQuery {
    page: number;
    limit: number;
    sort: string;
}

interface ReviewAuthor {
    id: string;
    email: string;
    fullName: string;
    avatar: string | null;
}

/** Shape returned to clients for a single review. */
const toReviewResponse = (review: {
    id: string;
    rating: number;
    title: string | null;
    text: string;
    images: string[];
    helpfulCount: number;
    createdAt: Date;
    variantLabel?: string | null;
    verifiedPurchase?: boolean;
    sellerRating?: number | null;
}, user: ReviewAuthor) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    text: review.text,
    images: review.images,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    variantLabel: review.variantLabel ?? null,
    verifiedPurchase: review.verifiedPurchase ?? false,
    sellerRating: review.sellerRating ?? null,
    user,
});

export class ReviewService {
    /**
     * Create a review (one per user per product)
     */
    async createReview(productId: string, userId: string, input: CreateReviewInput) {
        // Product existence, the duplicate check and the author lookup are
        // independent reads — running them together keeps submission at a single
        // round trip's latency instead of three.
        const [product, existing, author] = await Promise.all([
            prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
            prisma.review.findFirst({ where: { productId, userId }, select: { id: true } }),
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    user_profiles: { select: { full_name: true, avatar: true } },
                },
            }),
        ]);

        if (!product) throw ApiError.notFound('Product not found');
        if (existing) throw ApiError.conflict('You have already reviewed this product');

        // Only customers who received this product can review it.
        const purchase = await this.deliveredPurchase(productId, userId);
        if (!purchase) {
            throw ApiError.forbidden('Only customers who bought and received this product can review it.');
        }

        // Spam guards: a daily cap and no copy-pasting the same review.
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await prisma.review.findMany({
            where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            select: { text: true, createdAt: true },
        });
        if (recent.filter((r) => r.createdAt >= dayAgo).length >= REVIEWS_PER_DAY) {
            throw new ApiError(429, 'You have posted several reviews today. Please try again tomorrow.');
        }
        const mine = normalizeText(input.text);
        if (mine.length > 20 && recent.some((r) => normalizeText(r.text) === mine)) {
            throw ApiError.badRequest('This review matches one you already posted. Please describe this product.');
        }

        const created = await prisma.review.create({
            data: {
                productId,
                userId,
                rating: input.rating,
                title: input.title ?? null,
                text: input.text,
                images: input.images ?? [],
                verifiedPurchase: true,
                orderId: purchase.orderId,
                variantId: purchase.variantId,
                variantLabel: purchase.variantLabel,
                sellerRating: input.sellerRating ?? null,
            },
        });

        // The review list is cached for 60s, so this invalidation has to land
        // before the client refetches. The product-detail cache only affects the
        // aggregate rating, so it can settle after the response.
        await invalidateCacheByPattern(`reviews:${productId}:*`);
        void invalidateCacheByPattern(`products:detail:${productId}`);

        return toReviewResponse(created, {
            id: userId,
            email: author?.email ?? '',
            fullName: author?.user_profiles?.full_name ?? 'Anonymous',
            avatar: author?.user_profiles?.avatar ?? null,
        });
    }

    /**
     * Get reviews for a product with pagination, sorting, and rating summary
     */
    async getProductReviews(productId: string, query: ReviewQuery) {
        const cacheKey = CACHE_KEYS.PRODUCT_REVIEWS(productId, query.page, query.limit, query.sort);
        const cached = await getFromCache<any>(cacheKey);
        if (cached) {
            return cached;
        }

        const skip = (query.page - 1) * query.limit;

        const orderBy: any = (() => {
            switch (query.sort) {
                case 'oldest': return { createdAt: 'asc' as const };
                case 'highest': return { rating: 'desc' as const };
                case 'lowest': return { rating: 'asc' as const };
                case 'helpful': return { helpfulCount: 'desc' as const };
                case 'newest':
                default: return { createdAt: 'desc' as const };
            }
        })();

        const where = { productId, isHidden: false };

        const [reviews, total, ratingAgg] = await Promise.all([
            prisma.review.findMany({
                where,
                orderBy,
                skip,
                take: query.limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            user_profiles: { select: { full_name: true, avatar: true } },
                        },
                    },
                },
            }),
            prisma.review.count({ where }),
            // Same `where` as the list: aggregating over hidden reviews too made
            // summary.totalReviews disagree with pagination.total, and let a
            // moderated review keep skewing the average.
            prisma.review.groupBy({
                by: ['rating'],
                where,
                _count: { rating: true },
            }),
        ]);

        // Build rating distribution
        const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalRatings = 0;
        let ratingSum = 0;
        for (const r of ratingAgg) {
            ratingDistribution[r.rating] = r._count.rating;
            totalRatings += r._count.rating;
            ratingSum += r.rating * r._count.rating;
        }

        const response = {
            reviews: reviews.map((r: any) =>
                toReviewResponse(r, {
                    id: r.user.id,
                    // Admin-written reviews carry their own name; never expose the admin's email.
                    email: r.authorName ? '' : r.user.email,
                    fullName: r.authorName ?? r.user.user_profiles?.full_name ?? 'Anonymous',
                    avatar: r.user.user_profiles?.avatar ?? null,
                }),
            ),
            summary: {
                averageRating: totalRatings > 0 ? +(ratingSum / totalRatings).toFixed(1) : 0,
                totalReviews: totalRatings,
                ratingDistribution,
                verifiedReviews: await prisma.review.count({ where: { ...where, verifiedPurchase: true } }),
                seller: await (async () => {
                    const product = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true } });
                    if (!product) return null;
                    const store = await prisma.seller_profiles.findUnique({ where: { user_id: product.sellerId }, select: { store_name: true } });
                    return { name: store?.store_name ?? null, rating: await this.sellerRating(product.sellerId) };
                })(),
            },
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
        await setCache(cacheKey, response, 60);
        return response;
    }

    /** The delivered order item that lets this customer review the product. */
    async deliveredPurchase(productId: string, userId: string) {
        const item = await prisma.orderItem.findFirst({
            where: { productId, order: { userId, status: 'DELIVERED' } },
            select: { orderId: true, variantId: true },
            orderBy: { order: { createdAt: 'desc' } },
        });
        if (!item) return null;
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { size: true, color: true } });
        const variantLabel = variant
            ? [variant.color, variant.size && variant.size !== 'Default' ? variant.size : null].filter(Boolean).join(' / ') || null
            : null;
        return { orderId: item.orderId, variantId: item.variantId, variantLabel };
    }

    /** Can this customer review the product, and have they already? */
    async eligibility(productId: string, userId: string) {
        const [existing, purchase] = await Promise.all([
            prisma.review.findFirst({ where: { productId, userId }, select: { id: true } }),
            this.deliveredPurchase(productId, userId),
        ]);
        if (existing) return { canReview: false, alreadyReviewed: true, reason: 'You have already reviewed this product.' };
        if (!purchase) return { canReview: false, alreadyReviewed: false, reason: 'You can review this product after it is delivered to you.' };
        return { canReview: true, alreadyReviewed: false, reason: null, variantLabel: purchase.variantLabel };
    }

    /**
     * Helpful vote: one per customer per review, tapping again takes it back.
     * Authors cannot vote on their own review.
     */
    async markHelpful(reviewId: string, userId?: string) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) throw ApiError.notFound('Review not found');
        if (!userId) throw ApiError.unauthorized('Please sign in to vote');
        if (review.userId === userId) throw ApiError.badRequest('You cannot vote on your own review');

        const existing = await prisma.reviewVote.findUnique({ where: { reviewId_userId: { reviewId, userId } } });
        const updated = await prisma.$transaction(async (tx) => {
            if (existing) {
                await tx.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId } } });
            } else {
                await tx.reviewVote.create({ data: { reviewId, userId } });
            }
            return tx.review.update({
                where: { id: reviewId },
                data: { helpfulCount: existing ? Math.max(0, review.helpfulCount - 1) : review.helpfulCount + 1 },
                select: { id: true, helpfulCount: true },
            });
        });

        await invalidateCacheByPattern(`reviews:${review.productId}:*`);
        return { ...updated, voted: !existing };
    }

    /** Which of these reviews the customer marked helpful (for highlighting). */
    async myVotes(userId: string, reviewIds: string[]) {
        if (!reviewIds.length) return [];
        const votes = await prisma.reviewVote.findMany({ where: { userId, reviewId: { in: reviewIds } }, select: { reviewId: true } });
        return votes.map((v) => v.reviewId);
    }

    /** Report a review; enough reports hide it until an admin decides. */
    async report(reviewId: string, userId: string, input: { reason: string; details?: string | undefined }) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) throw ApiError.notFound('Review not found');
        if (review.userId === userId) throw ApiError.badRequest('You cannot report your own review');
        try {
            await prisma.reviewReport.create({ data: { reviewId, userId, reason: input.reason, details: input.details ?? null } });
        } catch {
            return { reported: true, alreadyReported: true };
        }
        const updated = await prisma.review.update({
            where: { id: reviewId },
            data: { reportCount: { increment: 1 } },
            select: { reportCount: true, isHidden: true },
        });
        if (updated.reportCount >= REPORTS_TO_HIDE && !updated.isHidden) {
            await prisma.review.update({ where: { id: reviewId }, data: { isHidden: true } });
            await invalidateCacheByPattern(`reviews:${review.productId}:*`);
            void notificationService.notifyAdmin(
                'Review hidden after reports',
                `Review ${reviewId} on product ${review.productId} was reported ${updated.reportCount} times and is hidden until you review it (Admin → Reviews → Reported).`,
            ).catch(() => undefined);
        }
        return { reported: true, alreadyReported: false };
    }

    /** Admin queue: reviews with unresolved reports. */
    async listReported() {
        const reports = await prisma.reviewReport.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: 'desc' }, take: 500 });
        const ids = [...new Set(reports.map((r) => r.reviewId))];
        const reviews = ids.length
            ? await prisma.review.findMany({
                where: { id: { in: ids } },
                include: { product: { select: { id: true, title: true } }, user: { select: { email: true, user_profiles: { select: { full_name: true } } } } },
            })
            : [];
        return {
            reviews: reviews.map((r) => ({
                id: r.id,
                product: r.product,
                author: r.user.user_profiles?.full_name ?? r.user.email,
                rating: r.rating,
                text: r.text,
                images: r.images,
                isHidden: r.isHidden,
                verifiedPurchase: r.verifiedPurchase,
                createdAt: r.createdAt.toISOString(),
                reports: reports.filter((x) => x.reviewId === r.id).map((x) => ({ reason: x.reason, details: x.details, createdAt: x.createdAt.toISOString() })),
            })),
        };
    }

    /** Admin decision on a reported review: keep it visible, or remove it. */
    async resolveReports(reviewId: string, action: 'KEEP' | 'REMOVE') {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) throw ApiError.notFound('Review not found');
        await prisma.$transaction([
            prisma.reviewReport.updateMany({ where: { reviewId, resolvedAt: null }, data: { resolvedAt: new Date() } }),
            prisma.review.update({ where: { id: reviewId }, data: { isHidden: action === 'REMOVE', ...(action === 'KEEP' ? { reportCount: 0 } : {}) } }),
        ]);
        await invalidateCacheByPattern(`reviews:${review.productId}:*`);
        return { ok: true };
    }

    /** Average service rating a seller has received across their products' reviews. */
    async sellerRating(sellerId: string) {
        const agg = await prisma.review.aggregate({
            where: { isHidden: false, sellerRating: { not: null }, product: { sellerId } },
            _avg: { sellerRating: true },
            _count: { sellerRating: true },
        });
        return { average: agg._avg.sellerRating ? +agg._avg.sellerRating.toFixed(1) : null, count: agg._count.sellerRating };
    }

    /**
     * Set hidden state on a review (admin)
     */
    async setHidden(reviewId: string, isHidden: boolean) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) throw ApiError.notFound('Review not found');

        const updated = await prisma.review.update({
            where: { id: reviewId },
            data: { isHidden },
        });

        await invalidateCacheByPattern(`reviews:${review.productId}:*`);
        return updated;
    }

    /**
     * List all reviews for admin (includes hidden)
     */
    async listReviews(params?: { page?: number; limit?: number }) {
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 50;

        const reviews = await reviewRepository.findAll({
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            reviews: reviews.map((review: any) => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                text: review.text,
                images: review.images,
                helpfulCount: review.helpfulCount,
                isHidden: review.isHidden,
                createdAt: review.createdAt,
                authorName: review.authorName ?? null,
                product: {
                    id: review.product.id,
                    title: review.product.title,
                },
                user: {
                    id: review.user.id,
                    email: review.authorName ? null : review.user.email,
                    fullName: review.authorName ?? review.user.user_profiles?.full_name ?? 'Anonymous',
                    avatar: review.user.user_profiles?.avatar ?? null,
                },
            })),
        };
    }

    async deleteReview(id: string) {
        try {
            const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
            await reviewRepository.deleteById(id);
            if (review?.productId) {
                await invalidateCacheByPattern(`reviews:${review.productId}:*`);
            }
        } catch (error: any) {
            if (error?.code === 'P2025') {
                throw ApiError.notFound('Review not found');
            }
            throw error;
        }
    }
}

export const reviewService = new ReviewService();
