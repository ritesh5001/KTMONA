import { prisma } from '../config/db.js';
import { ApiError } from '../errors/ApiError.js';
import { reviewRepository } from '../repositories/review.repository.js';
import { CACHE_KEYS, getFromCache, setCache, invalidateCacheByPattern, } from '../utils/cache.util.js';
/** Shape returned to clients for a single review. */
const toReviewResponse = (review, user) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    text: review.text,
    images: review.images,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
    user,
});
export class ReviewService {
    /**
     * Create a review (one per user per product)
     */
    async createReview(productId, userId, input) {
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
        if (!product)
            throw ApiError.notFound('Product not found');
        if (existing)
            throw ApiError.conflict('You have already reviewed this product');
        const created = await prisma.review.create({
            data: {
                productId,
                userId,
                rating: input.rating,
                title: input.title ?? null,
                text: input.text,
                images: input.images ?? [],
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
    async getProductReviews(productId, query) {
        const cacheKey = CACHE_KEYS.PRODUCT_REVIEWS(productId, query.page, query.limit, query.sort);
        const cached = await getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const skip = (query.page - 1) * query.limit;
        const orderBy = (() => {
            switch (query.sort) {
                case 'oldest': return { createdAt: 'asc' };
                case 'highest': return { rating: 'desc' };
                case 'lowest': return { rating: 'asc' };
                case 'helpful': return { helpfulCount: 'desc' };
                case 'newest':
                default: return { createdAt: 'desc' };
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
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalRatings = 0;
        let ratingSum = 0;
        for (const r of ratingAgg) {
            ratingDistribution[r.rating] = r._count.rating;
            totalRatings += r._count.rating;
            ratingSum += r.rating * r._count.rating;
        }
        const response = {
            reviews: reviews.map((r) => toReviewResponse(r, {
                id: r.user.id,
                email: r.user.email,
                fullName: r.user.user_profiles?.full_name ?? 'Anonymous',
                avatar: r.user.user_profiles?.avatar ?? null,
            })),
            summary: {
                averageRating: totalRatings > 0 ? +(ratingSum / totalRatings).toFixed(1) : 0,
                totalReviews: totalRatings,
                ratingDistribution,
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
    /**
     * Mark a review as helpful (increment counter)
     */
    async markHelpful(reviewId) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review)
            throw ApiError.notFound('Review not found');
        const updated = await prisma.review.update({
            where: { id: reviewId },
            data: { helpfulCount: { increment: 1 } },
            select: { id: true, helpfulCount: true },
        });
        await invalidateCacheByPattern(`reviews:${review.productId}:*`);
        return updated;
    }
    /**
     * Set hidden state on a review (admin)
     */
    async setHidden(reviewId, isHidden) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review)
            throw ApiError.notFound('Review not found');
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
    async listReviews(params) {
        const page = params?.page ?? 1;
        const limit = params?.limit ?? 50;
        const reviews = await reviewRepository.findAll({
            skip: (page - 1) * limit,
            take: limit,
        });
        return {
            reviews: reviews.map((review) => ({
                id: review.id,
                rating: review.rating,
                title: review.title,
                text: review.text,
                images: review.images,
                helpfulCount: review.helpfulCount,
                isHidden: review.isHidden,
                createdAt: review.createdAt,
                product: {
                    id: review.product.id,
                    title: review.product.title,
                },
                user: {
                    id: review.user.id,
                    email: review.user.email,
                    fullName: review.user.user_profiles?.full_name ?? 'Anonymous',
                    avatar: review.user.user_profiles?.avatar ?? null,
                },
            })),
        };
    }
    async deleteReview(id) {
        try {
            const review = await prisma.review.findUnique({ where: { id }, select: { productId: true } });
            await reviewRepository.deleteById(id);
            if (review?.productId) {
                await invalidateCacheByPattern(`reviews:${review.productId}:*`);
            }
        }
        catch (error) {
            if (error?.code === 'P2025') {
                throw ApiError.notFound('Review not found');
            }
            throw error;
        }
    }
}
export const reviewService = new ReviewService();
//# sourceMappingURL=review.service.js.map